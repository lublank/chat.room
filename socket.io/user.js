'use strict';

var async = require('async');
var winston = require('winston');
var util = require('util');
var isNumeric = require('isnumeric');

var cxn1 = require('../database/redis').connect();

cxn1.select(1, function(err){
  
});

var SocketUser = module.exports = {};

SocketUser.updateUserROE = function(socket, data, callback){
  if(!data){
    data = 0;
  }else if(!isNumeric(data)){
    return callback(new Error('[[error:invalid-params]]'));
  }
  
  updateUserROE(socket.uid, data, callback);
};

SocketUser.toggleUserROE = function(socket, data, callback){
  if(!data){
    data = 0;
  }else if(!isNumeric(data)){
    return callback(new Error('[[error:invalid-params]]'));
  }
  
  toggleUserROE(socket.uid, data, callback);
};

function uniq(a) {
  var seen = {};
  var out = [];
  var len = a.length;
  var j = 0;
  for(var i = 0; i < len; i++) {
    var item = a[i];
    if(seen[item] !== 1) {
      seen[item] = 1;
      out[j++] = item;
    }
  }
  return out;
}

function updateUserROE(uid, roe, callback){
  cxn1.hset('user:info:' + uid, 'rate', roe, function(err){
    if(err){
      return callback(err);
    }
    callback(null, roe);
  });
}

function toggleUserROE(uid, state, callback){
  cxn1.hset('user:info:' + uid, 'rate_state', state, function(err){
    if(err){
      return callback(err);
    }
    callback(null, state);
  });
}

