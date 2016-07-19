'use strict';

var winston = require('winston');
var ccap = require('ccap');

var defaults = {
  width: 100,           // set width,default is 256
  height: 40,           // set height,default is 60
  offset: 23,           // set text spacing,default is 40
  quality: 150,         // set pic quality,default is 50
  fontsize: 32,         // 字体大小
  generate: function(){ // Custom the function to generate captcha text
    //generate captcha text here
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = '';
    for (var i = 4; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
    return result;
  }
};

//var sessions = ['login', 'register'];
var Captcha = ccap(defaults);

var captchController = module.exports = {};

captchController.verify = function(req, res, next){
  var sessionKey = 'verifyCaptcha';
  
  res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.header('Expires', '-1');
  res.header('Pragma', 'no-cache');
  
  var captcha = Captcha.get();
  
  req.session[sessionKey] = captcha[0];
  
  res.type('image/jpeg').end(captcha[1], 'binary');
};
