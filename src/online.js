'use strict';

var	async = require('async'),
    nconf = require('nconf'),
    db = require('../database');

(function(Online){
    //获取房间里的在线用户数
    Online.getOnlineCount = function(room, callback){
        db.getObjectFieldsLen(room, callback);
    };
    //用户连接时数值增加一，断开连接时减一
    Online.incOnlineField = function(room, userId, value, callback) {
        async.waterfall([
            function(next){
                db.incrObjectFieldBy(room, userId, value, next);
            },function(val, next){
                //当该域的值为0时，将其删掉
                if(val > 0){
                    return callback(null, next);
                }
                db.deleteObjectField(room, userId, next);
            }],function(err){
            if(err){
                return callback(err);
            }
        });
    }
}(exports));