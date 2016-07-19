'use strict';

var async = require('async');
var db = require('../database');
var nconf = require('nconf');
var user = require('../src/user');
var Controllers = module.exports = {
    chatList: require('./chat'),
    room: require('./room'),
    user: require('./user'),
    captcha: require('./captcha')
};

function desc(a, b){
  return b.order-a.order;
}

Controllers.chat = function(req, res, next){

    var room = req.param('room')||'global';

  //获取客户端ip
  var uip = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

  var username = {} ;
    if(req.session.uid){
        username = req.session.user;
    }else{
        if(req.cookies.guestId){
            username.name = req.cookies.guestId;
        }else{
            username.name = uip.split(':')[3];
            res.cookie('guestId', username.name, {
                maxAge: 5184000000
            });
        }

    }

    //获取聊天消息
    async.parallel([function(next){
        db.getSortedSetRange(room, 0, -1, function(err, res){
            if (err) {
                return console.log('Error:' + err);
            }
            //打印聊天消息
            console.dir(res);
            next(null, res);
        });
    },function(next){
        //获取房间信息
        db.getObject('rooms', function(err, result){
            if (err) {
                return console.log('Error:' + err);
            }
            var room = [];
            for(var k in result) {
                var tmp = {};
                tmp.ename = k;
                tmp.cname = result[k];
                room.push(tmp);
            }
            next(null, room);
        });
    }],function(err, results){
        console.log(username);
        res.render('chat', {user: username, chats: results[0], rooms: results[1], emoji: 131});
    });
};

//用户列表
Controllers.list = function(req, res, next){
    async.waterfall([
            function (next) {
                user.getUserList(next);
            }],
        function(err, result){

            var users = [];
            var data = {};
            for(var k in result) {
                var tmp = {};
                tmp.name = k;
                tmp.uid = result[k];
                users.push(tmp);
            }
            data.relative_path = nconf.get('relative_path');
            res.render('list', {users: users, data: data});
        });
};

//房间列表
Controllers.rooms = function (req, res, next) {
    var uid = req.session.uid;
    if(uid && req.session.user.role == 0){
        //获取房间信息
        db.getObject('rooms', function(err, result){
            if (err) {
                console.log('Error:' + err);
            }
            var room = [];
            for(var k in result) {
                var tmp = {};
                tmp.ename = k;
                tmp.cname = result[k];
                room.push(tmp);
            }
            res.render('rooms', {rooms: room});
        });
    }else{
        res.render('error');
    }
};