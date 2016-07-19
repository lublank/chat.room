'use strict';

var path = require('path');
var nconf = require('nconf');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var favicon = require('serve-favicon');
var session = require('express-session');
var expressValidator = require('express-validator');
var fs = require('fs');

//var meta = require('../meta');
var db = require('../database');

var middleware = {};

module.exports = function(app){
  app.set('views', nconf.get('views_dir')); //设置视图views路径
  app.set('view engine', 'ejs');            //视图模板引擎ejs
  app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
  
  middleware = require('./middleware')(app);

  //************************meta---图标**********
  //setupFavicon(app);
  
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(expressValidator({customValidators: middleware.validators}));

  //**********************cookie**************************//
  //var cookie = {
  //  maxAge: 1000 * 60 * 60 * 24 * parseInt(meta.config.loginDays || 14, 10)
  //};
  //
  //if (meta.config.cookieDomain) {
  //  cookie.domain = meta.config.cookieDomain;
  //}
/*
 |--------------------------------------
 | database session
 |--------------------------------------
*/
  app.use(session({
    store: db.sessionStore,
    secret: nconf.get('secret'),
    key: 'sosobtc.sid',
    //cookie: cookie,
    resave: false,
    saveUninitialized: false
  }));
  
  app.use(function (req, res, next) {
    res.setHeader('X-Powered-By', 'SosoBtc');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // 
    res.setHeader("P3P","CP=CAO PSA OUR");

    //****************setHeader*****************************//
    //if (meta.config['allow-from-uri']) {
    //  res.setHeader('ALLOW-FROM', meta.config['allow-from-uri']);
    //}

    next();
  });

  /*
   |
   */
  app.use(middleware.processRender);
  
  return middleware;
};

//function setupFavicon(app) {
//  var faviconPath = path.join(__dirname, '../../', 'public', meta.config['brand:favicon'] ? meta.config['brand:favicon'] : 'favicon.ico');
//  if (fs.existsSync(faviconPath)) {
//    app.use(favicon(faviconPath));
//  }
//}