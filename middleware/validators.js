'use strict';

var Validators = module.exports = {};

Validators.equal = function(val, expected){
  return val === expected;
};

Validators.iequal = function(val, expected){
  return (new RegExp('^' + expected + '$', 'i')).test(val);
};

Validators.isPhone = function(val){
  return /^(13[0-9]|147|15[^4\D]|18[^14\D])\d{8}$/.test(val);
};

Validators.isEmail = function(val){
  return /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(val);
};

Validators.isAccount = function(val){
  return(
    // 手机号码
    Validators.isPhone(val) ||
    // 邮箱地址
    Validators.isEmail(val) ||
    // 账号
    Validators.isLegalWord(val, 6, 32));
};

Validators.isLegalWord = function(val, min, max){
  min = (min - 1) || 0;
  max = (max - 1) || min;
  return (new RegExp('^[a-z][0-9a-z_]{' + min + ',' + max + '}$', 'i')).test(val);
};

Validators.isPassword = function(val){
  return /^[^\u4e00-\u9fa5]{6,32}$/g.test(val);
};

Validators.isNormalWords = function(val, minLength, maxLength){
  minLength = minLength || 1;
  maxLength = maxLength || minLength;
  
  return (new RegExp('^[0-9a-z]{' + minLength + ',' + maxLength + '}$', 'i')).test(val);
};