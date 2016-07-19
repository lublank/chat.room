'use strict';

var async = require('async');
var db = require('../database');
var nconf = require('nconf');
var moment = require('moment');
var chatController = module.exports = {};

chatController.chatList = function(req, res, next){
  var room = req.param('room')||'global';
  //获取聊天消息
  async.waterfall([function(next){
    db.getSortedSetRevRange(room, 0, -1, function(err, res){
      if (err) {
        console.log('Error:' + err);
        return;
      }
      //打印聊天消息
      console.dir(res);
      next(null, res);
    });
  },function(results){
    var data = {},
        chatData = [],
        tmp = {};
    data.relative_path = nconf.get('relative_path');
    results.forEach(function(chat){
      chat = JSON.parse(chat);
      tmp.id = chat.id;
      tmp.userid = chat.userid;
      tmp.content = chat.content;
      tmp.username = chat.username;
      tmp.room = chat.room;
      tmp.time = moment(chat.time).format('YYYY-MM-DD hh:mm:ss');
      chatData.push(tmp);
      tmp = {};
    });
    res.render('chatList', {chats: chatData, data: data});
  }]);
};