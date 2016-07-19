'use strict';

var async = require('async'),
  nconf = require('nconf'),
  cookieParser = require('cookie-parser')(nconf.get('secret')),
  
  db = require('../database'),
  user = require('../user');

var Auth = module.exports = {};

Auth.authorize = function(socket, callback){
  var handshake = socket.request;

  if (!handshake) {
    return callback(new Error('[[error:not-authorized]]'));
  }
  
  if(socket.uid > 0){
    return callback();
  }

  async.waterfall([
    function(next) {
      cookieParser(handshake, {}, next);
    },
    function(next) {
      db.sessionStore.get(handshake.signedCookies['sosobtc.sid'], function(err, sessionData) {
        if (err) {
          return next(err);
        }
        if (sessionData && sessionData.uid && sessionData.user) {
          socket.uid = parseInt(sessionData.uid, 10);
          socket.user = sessionData.user;
          
          user.updateUserData(socket.uid, sessionData.user, function(err){
            if(err){
              return next(err);
            }
            
            next();
          });
        } else {
          socket.uid = 0;
          next();
        }
      });
    }
  ], callback);
};