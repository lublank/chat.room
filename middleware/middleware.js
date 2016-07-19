'use strict';

var nconf = require('nconf');
var csrf = require('csurf');
var async = require('async');
var winston = require('winston');

//var meta = require('../meta');
//var controllers = {
//      api: require('../controllers/api')
//    };

var validators = require('./validators');
//var user = require('../user');
var utils = require('../public/utils');

var app = null;
var middleware = {};

middleware.validators = validators;

middleware.applyCSRF = csrf();

middleware.buildHeader = function(req, res, next) {

  //。。。。。。。。。。
};

middleware.renderHeader = function(req, res, next){

  //***
  //*省略。。。
  //***
  app.render('header', {}, next);

};

middleware.processRender = function(req, res, next) {
  // res.render post-processing, modified from here: https://gist.github.com/mrlannigan/5051687
  var render = res.render;
  res.render = function(template, options, fn) {
    var self = this,
      req = this.req,
      app = req.app,
      defaultFn = function(err, str){
        if (err) {
          return req.next(err);
        }

        self.send(str);
      };

    options = options || {};

    if ('function' === typeof options) {
      fn = options;
      options = {};
    }

    options.loggedIn = req.user ? parseInt(req.user.uid, 10) !== 0 : false;
    options.template = {name: template};
    options.template[template] = true;
    res.locals.template = template;

    if ('function' !== typeof fn) {
      fn = defaultFn;
    }

    if (res.locals.isAPI) {
      return res.json(options);
    }

    render.call(self, template, options, function(err, str) {
      if (err) {
        winston.error(err);
        return fn(err);
      }

      // str = str + '<input type="hidden" ajaxify-data="' + encodeURIComponent(JSON.stringify(options)) + '" />';
      str = (res.locals.postHeader ? res.locals.postHeader : '') + str + (res.locals.preFooter ? res.locals.preFooter : '');

      if (res.locals.footer) {
        str = str + res.locals.footer;
      } else if (res.locals.adminFooter) {
        str = str + res.locals.adminFooter;
      }

      if (res.locals.renderHeader || res.locals.renderAdminHeader) {
        var method = res.locals.renderHeader ? middleware.renderHeader : middleware.admin.renderHeader;
        method(req, res, function(err, template) {
          if (err) {
            return fn(err);
          }
          fn(null, template + str);
        });
      } else {
        fn(err, str);
      }
    });
  };

  next();
};

module.exports = function(webserver) {
  app = webserver;

  return middleware;
};