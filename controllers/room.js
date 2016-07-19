'use strict';

var db = require('../database');
var Segment = require('segment');

var roomController = module.exports = {};

roomController.roomAdd = function(req, res, next){
  //新增房间
  var eName  = req.body.eName;
  var cName  = req.body.cName;

  var uid = req.session.uid;
  if(uid && req.session.user.role == 0){
    db.isObjectField('rooms', eName, function(err, exists){
      if(!exists){
        db.setObjectField('rooms', eName, cName, function(err){
          if(err){
            console.log(err);
            res.json({suc: false, err: '添加房间失败！'});
          }else{
            res.json({suc: true, msg: '添加房间成功！'});
          }
        });
      }else{
        res.json({suc: false, err: '房间已存在，添加房间失败！'});
      }
    });
  }else{
    res.json({suc: false, err: '操作失败！'});
  }
};

roomController.roomDel = function(req, res, next){
  //删除房间
  var rid  = req.body.rid;

  var uid = req.session.uid;
  if(uid && req.session.user.role == 0){
    //获取房间信息
    console.log('删除房间', rid);
    db.deleteObjectField('rooms', rid, function(err){
      res.json({suc: true, msg: '删除房间成功！'});
    });
  }else{
    res.json({suc: false, err: '操作失败！'});
  }
};
//分词
roomController.wordSplit = function(req, res, next){
  console.log('--------分词----------');
  var word  = req.query.word;

  var uid = req.session.uid;

  //创建实例
  var segment = new Segment();
  // 使用默认的识别模块及字典，载入字典文件需要1秒，仅初始化时执行一次即可
  segment.useDefault();

  //开始分词
  console.log(word);
  var text = '这是一个基于Node.js的中文分词模块。';
  var result = segment.doSegment(word);
console.log(result);
  res.status(200).json({suc: true, msg: result});

  //if(uid && req.session.user.role == 0){
  //  //获取房间信息
  //  console.log('删除房间', rid);
  //  db.deleteObjectField('rooms', rid, function(err){
  //    res.json({suc: true, msg: '删除房间成功！'});
  //  });
  //}else{
  //  res.json({suc: false, err: '操作失败！'});
  //}
};