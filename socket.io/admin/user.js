"use strict";


var async = require('async'),
  db = require('../../database'),
  groups = require('../../groups'),
  user = require('../../user'),
  meta = require('../../meta'),
  websockets = require('../index'),
  User = {};


User.makeAdmins = function(socket, uids, callback) {
  if(!Array.isArray(uids)) {
    return callback(new Error('[[error:invalid-data]]'));
  }

  async.map(uids, function(uid, next){
    async.series([function(next){
      user.getUserFields(uid, ['uid', 'name', 'banned'], function(err, userData){
        if(err){
          return next(err);
        }
        
        if(parseInt(userData.banned)){
          return next(new Error('[[error:cant-make-banned-users-admin]]'));
        }
        
        var msgObj = {
          uid: socket.uid,
          name: socket.user.name,
          body: '用户' + userData.name + '已被设置为管理员身份。',
          admin: true
        };
        next(null, msgObj);
      });
    }, function(next){
      groups.join('administrators', uid, next);
    }], function(err, results){
      if(err){
        return next(err);
      }
      socket.to('uid_' + uid).emit('event:makeAdmin');
      next(null, results[0]);
    });
    
  }, function(err, results){
    if(err){
      return callback(err);
    }
    var broadcast;
    if(socket._channel === 'global'){
      broadcast = broadcastToAllChannels;
    }else{
      broadcast = broadcastToSingleChannel;
    }
    async.each(results, function(msg, next){
      broadcast(socket, msg, next);
    }, function(){
      callback(null, results);
    });
  });
};

User.removeAdmins = function(socket, uids, callback) {
  if(!Array.isArray(uids)) {
    return callback(new Error('[[error:invalid-data]]'));
  }

  if (uids.indexOf(socket.uid.toString()) !== -1) {
    return callback(new Error('[[error:cant-remove-self-as-admin]]'));
  }

  async.mapSeries(uids, function(uid, next){
    async.parallel([function(next){
      groups.getMemberCount('administrators', function(err, count) {
        if (err) {
          return next(err);
        }
  
        if (count === 1) {
          return next(new Error('[[error:cant-remove-last-admin]]'));
        }
  
        groups.leave('administrators', uid, next);
      });
    }, function(next){
      user.getUserFields(uid, function(err, userData){
        if(err){
          return next(err);
        }
        var msgObj = {
          uid: socket.uid,
          name: socket.user.name,
          body: '用户' + userData.name + '已被撤销管理员身份。',
          admin: true
        };
        next(null, msgObj);
      });
    }], function(err, results){
      if(err){
        return next(err);
      }
      socket.to('uid_' + uid).emit('event:removeAdmin');
      next(null, results[1]);
    });
    
  }, function(err, results){
    if(err){
      return callback(err);
    }
    var broadcast;
    if(socket._channel === 'global'){
      broadcast = broadcastToAllChannels;
    }else{
      broadcast = broadcastToSingleChannel;
    }
    async.each(results, function(msg, next){
      broadcast(socket, msg, next);
    }, function(){
      callback(null, results);
    });
  });
};

User.queryStatus = function(socket, uid, callback) {
  async.parallel({
    isAdmin: function(next){
      user.isAdministrator(uid, next);
    },
    isBanned: function(next){
      user.isBanned(uid, next);
    }
  }, callback);
};

User.banUsers = function(socket, uids, callback) {
  toggleBan(uids, User.banUser, function(err){
    if(err){
      return callback(err);
    }
    async.map(uids, function(uid, next){
      user.getUserFields(uid, function(err, userData){
        if(err){
          return next(err);
        }
        var msgObj = {
          uid: socket.uid,
          name: socket.user.name,
          body: '用户' + userData.name + '已被禁言。',
          admin: true
        };
        next(null, msgObj);
      });
    }, function(err, results){
      if(err){
        return callback(err);
      }
      var broadcast;
      if(socket._channel === 'global'){
        broadcast = broadcastToAllChannels;
      }else{
        broadcast = broadcastToSingleChannel;
      }
      async.each(results, function(msg, next){
        broadcast(socket, msg, next);
      }, function(){
        callback(null, results);
      });
    });
  });
};

User.unbanUsers = function(socket, uids, callback) {
  toggleBan(uids, user.unban, function(err){
    if(err){
      return callback(err);
    }
    async.map(uids, function(uid, next){
      user.getUserFields(uid, function(err, userData){
        if(err){
          return next(err);
        }
        var msgObj = {
          uid: socket.uid,
          name: socket.user.name,
          body: '用户' + userData.name + '已被解除禁言。',
          admin: true
        };
        next(null, msgObj);
      });
    }, function(err, results){
      if(err){
        return callback(err);
      }
      var broadcast;
      if(socket._channel === 'global'){
        broadcast = broadcastToAllChannels;
      }else{
        broadcast = broadcastToSingleChannel;
      }
      async.each(results, function(msg, next){
        broadcast(socket, msg, next);
      }, function(){
        callback(null, results);
      });
    });
  });
};

function broadcastToSingleChannel(socket, msgObj, callback){
  callback = callback || function(){};
  socket.to(socket._channel).to('global').emit('broadcast:channel.message', msgObj);
  callback();
}

function broadcastToAllChannels(socket, msgObj, callback){
  callback = callback || function(){};
  socket.to('*').emit('broadcast:channel.message', msgObj);
  callback();
}

function toggleBan(uids, method, callback) {
  if(!Array.isArray(uids)) {
    return callback(new Error('[[error:invalid-data]]'));
  }
  async.each(uids, method, callback);
}

User.banUser = function(uid, callback) {
  user.isAdministrator(uid, function(err, isAdmin) {
    if (err || isAdmin) {
      return callback(err || new Error('[[error:cant-ban-other-admins]]'));
    }

    user.ban(uid, function(err) {
      if (err) {
        return callback(err);
      }

      websockets.in('/chat', 'uid_' + uid).emit('event:banned');

      callback();
    });
  });
};

module.exports = User;