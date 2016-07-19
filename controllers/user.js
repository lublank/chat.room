'use strict';

var async = require('async');
var nconf = require('nconf');
var dateFormat = require('dateformat');

var password = require('../src/password');
var user = require('../src/user');
var validators = require('../middleware/validators');

var userController = module.exports = {};

userController.login = function(req, res, next){
  var userObj, hashed,
    secureKey = nconf.get('secureKey');
  
  if(req.session.uid){
    res.json({succ: true, results: {msg: '登录成功', user: req.session.user}});
    return;
  }
  
  async.waterfall([
    function checkBody(next){
      req.checkBody('code', '非法的验证码').isNormalWords(4);
      req.checkBody('account', '非法的账号').isAccount();
      req.checkBody('password', '非法的密码').isPassword();

      var errors = req.validationErrors();
      if(errors){
        next({message: '[[error:invalid-input]]', results: errors[0]});
        return;
      }

      req.checkBody('code', '验证码不正确或已过期').iequal(req.session.verifyCaptcha);
      errors = req.validationErrors();
      if(errors){
        next({message: '[[error:invalid-input]]', results: errors[0]});
        return;
      }
      
      next();
    },
    async.apply(password.hash, req.body.password),
    function(password, next){
      hashed = password;
      //获取用户信息，并传递给下一个function
      user.getUserDataByAccount(req.body.account, password, next);
    },
    function(userData, next){

      if(!userData.id){
        return next(new Error('[[error:user-not-exists]]'));
      }
      password.hmac(hashed + secureKey, secureKey, function(err, data){
        if(err){
          return next(err);
        }
        
        var sessionData = {
          u: userData.id.toString(),
          n: userData.lg_account,
          r: userData.role,
          p: data
        };
        
        userObj = {
          uid: sessionData.u,
          name: sessionData.n,
          role: sessionData.r,
          lastIp: userData.thisip,
          lastLogin: userData.thistime
        };

        next(null, sessionData);

      });
    },
    function(sessionData, next){
      async.parallel({
        updateOnlineData: function(next){
          var now = dateFormat(Date.now(), 'yyyy-mm-dd HH:MM:ss');
          user.updateOnlineData(userObj.uid, {thistime: now, thisip: req.ip}, next);
        },
        isAdmin: function(next){
          user.isAdministrator(userObj.uid, next);
        }
      }, function(err, results){
        if(err){
          return next(err);
        }

        userObj.isAdmin = results.isAdmin;
        next(null, sessionData);
      });
    }
  ], function(err, sessionData){
    req.session.verifyCaptcha = null;
    
    if(err){
      return res.json({err: err.message, results: err.results || {param: 'account', msg: '该用户不存在或密码有误'}});
    }
    
    req.session.uid = userObj.uid;
    req.session.role = userObj.role;
    req.session.user = userObj;
    //res.cookie('chatid', sessionData, {
    //  maxAge: 5184000000,
    //  domain: nconf.get('session_domain')
    //});
    
    res.json({succ: true, results: {msg: '登录成功', user: userObj}});
  });
  
};

userController.register = function(req, res, next){
  var userObj, secureKey = nconf.get('secureKey');

  //判断是否已经登录过
  if(req.session.uid){
    res.json({succ: true, results: {msg: '登录成功', user: req.session.user}});
    return;
  }
  
  async.waterfall([
    function checkBody(next){
      req.checkBody('code', '非法的验证码').isNormalWords(4);
      req.checkBody('account', '非法的账号').isLegalWord(6, 32);
      req.checkBody('password', '非法的密码').isPassword();
      req.checkBody('confirmPassword', '两次输入的密码不一致').equal(req.body.password);

      var errors = req.validationErrors();
      if(errors){
        next({message: '[[error:invalid-input]]', results: errors[0]});
        return;
      }

      req.checkBody('code', '验证码不正确或已过期').iequal(req.session.verifyCaptcha);
      errors = req.validationErrors();
      if(errors){
        next({message: '[[error:invalid-input]]', results: errors[0]});
        return;
      }

      console.log(req.body.code+"===="+req.session.verifyCaptcha);

      next();
    },
    //password hash
    async.apply(password.hash, req.body.password),
    function(password, next){
      var now = dateFormat(Date.now(), 'yyyy-mm-dd HH:MM:ss');
      var userData = {
        lg_account: req.body.account,
        role: 2,//用户角色【0：超级管理员，1：管理员，2：普通用户】
        password: password,
        name: 'chat_' + Math.random().toString(16).slice(2, 8),
        createtime: now,
        thistime: now,
        thisip: req.ip
      };
      
      console.log('[controller user] create user', userData);

      //保存新用户信息到数据库
      user.create(userData, next);
    },
    function(userData, next){
      if(!userData.id){
        return next(new Error('[[error:user-not-exists]]'));
      }
      password.hash( userData.password + secureKey, secureKey, function(err, data){
        if(err){
          return next(err);
        }
        
        var sessionData = {
          u: userData.id,
          n: userData.lg_account,
          p: data
        };
        
        userObj = {
          uid: sessionData.u,
          name: sessionData.n,
          lastIp: '',
          lastLogin: ''
        };
        
        next(null, sessionData);
      });
    }
  ], function(err, sessionData){
    delete req.session.verifyCaptcha;
    
    if(err){
      return res.json({err: err.message, results: err.results || {param: 'account', msg: '该用户名已存在'}});
    }
    //保存session
    req.session.uid = userObj.uid;
    req.session.user = userObj;
    //res.cookie('chatid', sessionData, {
    //  maxAge: 5184000000,
    //  domain: nconf.get('session_domain')
    //});

    //返回：
    //{succ: true, results: {msg: "注册成功！已为您自动登录", user: {uid: 5, name: false, lastIp: "", lastLogin: ""}}}
    res.json({succ: true, results: {msg: '注册成功！已为您自动登录', user: userObj}});
  });
};

userController.getUserConfig = function(req, res, next){
  if(!req.session.uid){
    return res.json({err: '[[error:not-login]]'});
  }
  
  user.getUserConfig(req.session.uid, function(err, results){
    if(err){
      return res.json({err: err.message});
    }
    
    res.json({succ: true, results: results});
  });
};

//用户退出登录
userController.logout = function(req, res, next){
  if(!req.session.uid){
    res.redirect('back');
    return;
  }
  req.session.regenerate(function(){
    res.redirect('back');
  });
};

//判断用户是否被禁言
userController.isBan = function(req, res, next){
  user.isBanned(req.body.uid, function(err, isBanned){
    if(err){
      return res.json({suc: false, err: '获取数据失败'});
    }

    res.json({suc: true, isBanned: isBanned});
  });
};
//对用户禁言
userController.ban = function(req, res, next){
  user.ban(req.body.uid, function(err, username){
    if(err){
      return res.json({suc: false, err: '禁言失败'});
    }

    //若禁言成功则返回成功信息
    res.json({suc: true, msg: username + '已被禁言'});
  });
};
//删除聊天记录
userController.delChat = function(req, res, next){
  user.del(req.body.room, req.body.tid, function(err){
    if(err){
      return res.json({suc: false, err: '删除失败'});
    }

    //若禁言成功则返回被禁言用户名
    res.json({suc: true, msg: '删除成功'});
  });
};
