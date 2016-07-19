'use strict';

var async = require('async');
var winston = require('winston');
var extend = require('extend');
var util = require('util');
var nconf = require('nconf');

var db = require('../database');
var user = require('../user');
var Markets = require('../markets');
var utils = require('../../public/src/utils');
var natural = require('../natural');

var channels;
var channelMesageKeys = [];
var relative_path = nconf.get('relative_path');

Markets.listMarkets(function(err, markets){
  // 全部聊天频道
  markets.unshift({
    mid: 'global',
    name: '全部',
    url: '',
    order: 999
  });
  
  channels = markets;
  channelMesageKeys = channels.map(function(channel){
    return ('channel:' + channel.mid + ':message');
  });
});

var SocketChannels = module.exports = {
  message: {}
};

SocketChannels.before = function(socket, method, next){
  if(method === 'channels.enter' || method === 'channels.message.list'){
    return next();
  }
  if(socket.uid){
    user.isBanned(socket.uid, function(err, isBanned){
      if(err || isBanned){
        return next(err || new Error('[[error:user-banned]]'));
      }
      return next();
    });
  }else{
    return next();
  }
};

SocketChannels.enter = function(socket, channel, callback){
  if(typeof channel !== 'string' || !channel.length){
    return callback(new Error('[[error:invalid-params]]'));
  }
  async.waterfall([function(next){
    if(channel === 'global'){
      return next();
    }
    Markets.exists(channel, function(err, exists){
      if(err || !exists){
        return next(err || new Error('[[error:channel-not-exists]]'));
      }
      next();
    });
  }, function(next){
    if(socket._channel && socket._channel === channel){
      // load empty message
      return next(null, true);
    }
    next(null, false);
  }, function(loadEmpty, next){
    if(loadEmpty){
      return next();
    }
    
    async.parallel({
      leavePrevChnl: function(next){
        if(socket._channel){
          leavePrevChnl(socket);
        }
        next();
      },
      loadChnlMsg: function(next){
        var uid = socket.uid;
        
        db.getSortedSetRange('channel:' + channel + ':message', -100, -1, function(err, list){
          if(err){
            return next(err);
          }
          list = list.map(function(msg){
            msg = JSON.parse(msg);
            msg.own = uid && (uid === msg.uid);
            
            delete msg.ip;
            return msg;
          });
          next(null, list);
        });
      }
    }, function(err, results){
      if(err){
        return next(err);
      }
      next(null, results.loadChnlMsg);
    });
  }], function(err, msgList){
    if(err){
      return callback(err);
    }
    
    joinChannel(socket, channel);
    
    callback(null, msgList);
  });
};

SocketChannels.message.list = function(socket, data, callback){
  if(!socket._channel){
    return callback(new Error('[[error:invalid-params]]'));
  }
  
  var uid = socket.uid;
        
  db.getSortedSetRange('channel:' + socket._channel + ':message', -100, -1, function(err, list){
    if(err){
      return callback(err);
    }
    list = list.map(function(msg){
      msg = JSON.parse(msg);
      msg.own = uid && (uid === msg.uid);
      
      delete msg.ip;
      return msg;
    });
    callback(null, list);
  });
};

SocketChannels.message.push = function(socket, msg, callback){
  if(!socket.uid){
    return callback(new Error('[[error:need-login]]'));
  }
  
  if(!socket._channel){
    return callback(new Error('[[error:invalid-params]]'));
  }
  
  var msgObj = utils.formatMsg(msg);
  if(!msgObj.length || !msgObj.body){
    return callback(new Error('[[error:invalid-params]]'));
  }
  
  if(msgObj.length > 140){
    return callback(new Error('[[error:params-too-long]]'));
  }
  
  var channel = socket._channel;
  async.series([function(next){
    natural.replaceWith(msgObj.body, function(err, body){
      if(err){
        return next(err);
      }
      msgObj.body = body;
      next();
    });
  }, function(next){
    async.parallel({
      replaceEmoji: function(next){
        msgObj.emoji.forEach(function(emoji, idx){
          msgObj.body = msgObj.body.replace('#{' + idx + '}', '<img class="emoji" src="' + relative_path + '/images/emoji/' + emoji + '.png" />');
        });
        next();
      },
      replaceAts: function(next){
        async.map(msgObj.ats, function(uid, next){
          var idx = msgObj.ats.indexOf(uid);
          user.getUserFields(uid, function(err, data){
            if(err){
              return next(err);
            }
            msgObj.body = msgObj.body.replace('@{' + idx + '}', '@' + data.name + '&nbsp;');
            next();
          });
        }, next);
      }
    }, next);
  }, function(next){
    user.isAdministrator(socket.uid, function(err, isAdmin){
      var storeObj = {
        uid: socket.uid,
        name: socket.user.name,
        body: msgObj.body,
        ip: socket.ip,
        admin: isAdmin,
        create: Date.now()
      };
      
      if(channel === 'global'){
        broadcastToAllChannels(socket, storeObj, next);
      }else{
        broadcastToSingleChannel(socket, storeObj, next);
      }
    });
  }], function(err, results){
    if(err){
      return callback(err);
    }
    
    if(channel === 'global'){
      socket.to('*').emit('broadcast:channel.message', results[2]);
      async.map(msgObj.ats, function(uid, next){
        socket.to('uid_' + uid).emit('at:channel.message', results[2]);
      });
    }else{
      socket.to(channel).to('global').emit('broadcast:channel.message', results[2]);
      async.map(msgObj.ats, function(uid, next){
        socket.to('global_' + uid).to(channel + '_' + uid).emit('at:channel.message', results[2]);
      });
    }
    callback(null, results[2]);
  });
};

function broadcastToSingleChannel(socket, msgObj, callback){
  var channel = socket._channel;
  
  var chnls = ['channel:global:message', 'channel:' + channel + ':message'];
  storeChannelMessage(chnls, msgObj, callback);
}

function broadcastToAllChannels(socket, msgObj, callback){
  storeChannelMessage(msgObj, callback);
}

function storeChannelMessage(chnls, msgObj, callback){
  if(!util.isArray(chnls)){
    callback = msgObj;
    msgObj = chnls;
    chnls = channelMesageKeys;
  }
  
  async.waterfall([function(next){
    db.incrObjectField('global', 'next.message.id', next);
  }, function(msgId, next){
    msgObj.id = msgId;
    db.sortedSetsAdd(chnls, msgId, JSON.stringify(msgObj), function(err){
      if(err){
        return callback(err);
      }
      callback(null, msgObj);
    });
  }]);
}

function joinChannel(socket, channel){
  socket.join(channel);
  socket.join(channel + '_' + socket.uid);
  socket._channel = channel;
}

function leavePrevChnl(socket){
  socket.leave(socket._channel);
  socket.join(socket._channel + '_' + socket.uid);
  socket._channel = null;
}