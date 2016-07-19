'use strict';

var	async = require('async'),
	nconf = require('nconf'),

	db = require('../database'),
	redis = require('../database/redis');
	//Password = require('./password'),
	//Validators = require('./middleware/validators'),
	//utils = require('../public/src/utils');

var cxn1 = redis.connect();
cxn1.select(1, function(err){
  // TODO
});

(function(User) {

	//根据用户的账号获取用户信息--用于登录
	User.getUserDataByAccount = function(account, password, callback){
	    async.waterfall([function(next){
			//从userinfo的has表查找userid
			db.getObjectField('userinfo', account, next);
    	},
		function(userid, next){
			if(!userid){
				return callback(null, next);
			}
			db.getObject('user:'+userid, next);
		}], function(err, data){
			//判断用户名与密码是否正确
			//console.log('判断密码是否相等：'+data.password+" "+password);
			console.dir(data);
			callback(err, data && data.password == password ? data : 0);
		});
	};

	//新增用户
	User.create = function(userData, callback){
	  async.waterfall([
      async.apply(User.exists, userData.lg_account),
	  function(exists, next){
		  if(exists){
			  return next(new Error('[[error:account-already-exists]]'));
		  }
		  //hash 表存放userid自增量
		  db.incrObjectField('userid', 'next.user.id', next);
	  },
      function(userid, next){
		  userData.id = userid;
		  console.log("userid:"+userid);
		  //插入一条记录
          db.setObject('user:'+userid, userData, next);
		  //将新增用户的username保存到一个hash表中，方便以后查找
		  db.setObjectField('userinfo', userData.lg_account, userData.id);
		  //将新增用户的权限保存到一个sorted表中【score值表示role，0：超级管理员，1：管理员，2：普通用户】
		  db.sortedSetAdd('administrator', 2, userData.id);
      }], function(err){
	      if(err){
			  return callback(err);
		  }

		  callback(null, userData);
	  });
	};

	
	User.updateUserData = function(uid, data, callback){
	  db.setObject('user:' + uid, data, callback);
	};
	
	User.getUserFields = function(uid, fields, callback){
	  if(typeof fields === 'function'){
      callback = fields;
      fields = ['uid', 'name'];
    }
	  
	  db.getObjectFields('user:' + uid, fields, callback);
	};

	//更新登录信息thisTime,thisip
	User.updateOnlineData = function(uid, onlineData, callback){
		var tmp_data = {
			thistime: onlineData.thistime,
			thisip: onlineData.thisip
		};
		db.setObject('user:'+ uid, tmp_data, callback);
	};
	
	User.getUserConfig = function(uid, callback){
	  async.parallel({
	    markets: function(next){
	      cxn1.get('user:market:' + uid, next);
	    },
	    roe: function(next){
	      cxn1.hgetall('user:info:' + uid, next);
	    }
	  }, callback);
	};
	
	User.setUserField = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.setObjectField('user:' + uid, field, value, callback);
  	};

	//查找userinfo表是否存在该用户名
	User.exists = function(account, callback){
		db.isObjectField('userinfo', account, function(err, result){
			if(err){
				return callback(err);
			}
			callback(null, result);
		});
	};

	//查找uid对应的score值，判断是否为管理员
	User.isAdministrator = function(uid, callback) {
		db.isSortedSetMember('administrator', uid, callback);
	};

	//设置uid用户为管理员
	User.setAdmin = function(uid, callback) {
		User.setUserField(uid, 'role', 1, function(err) {
			if (err) {
				return callback(err);
			}
			async.parallel([function(next){
				db.sortedSetAdd('administrator', 1, uid, next);
			}, function(next){
				db.getObjectField('user:' + uid, 'lg_account', function(err, result){
					console.log('user.js130line '+result);
					next(null, result);
				});
			}], function(err, userData){
				if(err){
					return callback(err);
				}
				callback(null, userData[1]);
			});
		});
	};

	//撤销uid用户的管理员
	User.revokeAdmin = function(uid, callback) {
		async.waterfall([function(next) {
			db.getObjectField('user:' + uid, 'role', function (err, result) {
				next(null, result);
			});
		},function(role, next){
			if(role == 1){
				User.setUserField(uid, 'role', 2, function(err) {
					if (err) {
						return callback(err);
					}
					async.parallel([function(next){
						db.sortedSetAdd('administrator', 2, uid, next);
					}, function(next){
						db.getObjectField('user:' + uid, 'lg_account', function(err, result){
							console.log('user.js153line '+result);
							next(null, result);
						});
					}], function(err, userData){
						if(err){
							return callback(err);
						}
						callback(null, userData[1]);
					});
				});
			}else if(role == 0){
				return callback(true, 0);
			}
		}]);
	};
  
	User.isBanned = function(uid, callback){
		if(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(uid)){
			db.isSortedSetMember('users:banned', uid, function(err, res){
				if (err) {
					return callback(err);
				}
				console.log('user.js 181 line'+res);
				callback(null, res || 0);
			});
		}else {
			async.parallel([function (next) {
				User.getUserFields(uid, ['banned'], next);
			}, function (next) {
				db.isSortedSetMember('users:banned', uid, next);
			}], function (err, results) {
				if (err) {
					return callback(err);
				}
				callback(null, parseInt(results[0].banned) || results[1] || 0);
			});
		}
	};
  
	User.ban = function(uid, callback) {
		if(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(uid)){
			db.sortedSetAdd('users:banned', Date.now(), uid, function(err){
				if (err) {
					return callback(err);
				}
				callback(null, uid);
			});
		}else{
			User.setUserField(uid, 'banned', 1, function(err) {
				if (err) {
					console.log('user.js 193line'+err);
					return callback(err);
				}
				async.parallel([function(next){
					console.log('197line:'+uid);
					db.sortedSetAdd('users:banned', Date.now(), uid, next);
				}, function(next){
					db.getObjectField('user:' + uid, 'lg_account', function(err, result){
						console.log('user.js200line '+result);
						next(null, result);
					});
				}], function(err, userData){
					if(err){
						return callback(err);
					}
					console.log('user.js 206line '+userData);
					callback(null, userData[1]);
				});

			});
		}

	};

	User.unban = function(uid, callback) {
		if(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(uid)){
			db.sortedSetRemove('users:banned', uid, function(err){
				if (err) {
					return callback(err);
				}
				callback(null, uid);
			});
		}else {
			User.setUserField(uid, 'banned', 0, function (err) {
				if (err) {
					return callback(err);
				}
				async.parallel([function (next) {
					db.sortedSetRemove('users:banned', uid, next);
				}, function (next) {
					db.getObjectField('user:' + uid, 'lg_account', next);
				}], function (err, userData) {
					if (err) {
						return callback(err);
					}
					callback(null, userData[1]);
				});
			});
		}
	};

	User.getUserList = function (callback) {
		db.getObject('userinfo', function(err, result){
			if(err){
				return callback(err);
			}
			console.log('-------------user list-------------');
			console.dir(result);
			callback(null, result);
		});
	};

	User.del = function(room, tid, callback) {
		db.sortedSetsRemoveRangeByScore(room, tid, tid, callback);
	}

}(exports));
