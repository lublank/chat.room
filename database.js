"use strict";

(function(db){
  var async = require('async'),
    extend = require('extend'),
  
    redis = require('./database/redis'),
    
    redisInit = redis.init,
    redisClose = redis.close;
  
  db.init = function(callback){
    redisInit(function(err){
      extend(db, redis);
      callback(err);
    });
  };
  
  db.close = function(callback){
    redisClose(callback);
  };
})(module.exports);
