'use strict';

(function(module) {

  var winston = require('winston');
  var nconf = require('nconf');
  var session = require('express-session');
  var redis;
  var connectRedis;
  var redisClient;
  
  module.questions = [
    {
      name: 'redis:host',
      description: 'Host IP or address of your Redis instance',
      'default': nconf.get('redis:host') || '127.0.0.1'
    },
    {
      name: 'redis:port',
      description: 'Host port of your Redis instance',
      'default': nconf.get('redis:port') || 6379
    },
    {
      name: 'redis:password',
      description: 'Password of your Redis database',
      hidden: true,
      before: function(value) { value = value || nconf.get('redis:password') || ''; return value; }
    },
    {
      name: "redis:database",
      description: "Which database to use (0..n)",
      'default': nconf.get('redis:database') || 0
    }
  ];

  /*-----------------------
   | 初始化redis数据库
   | 以及数据库操作
   |-----------------------
   */
  module.init = function(callback) {
    console.log("=====================redis init=======================");
    try {
      redis = require('redis');
      connectRedis = require('connect-redis')(session);
    } catch (err) {
      winston.error('Unable to initialize Redis! Is Redis installed? Error :' + err.message);
      process.exit();
    }

    redisClient = module.connect();

    module.client = redisClient;

    module.sessionStore = new connectRedis({
      client: redisClient,
      ttl: 60 * 60 * 24 * 14
    });

    /*-----------------------
     | 初始化redis数据库操作
     |-----------------------
     */
    require('./redis/main')(redisClient, module);
    require('./redis/hash')(redisClient, module);
    require('./redis/sets')(redisClient, module);
    require('./redis/sorted')(redisClient, module);
    require('./redis/list')(redisClient, module);
console.log("----------redis init---------------");
    if(typeof callback === 'function') {
      callback();
    }
  };

  module.connect = function(options) {
    var cxn, dbIdx;

    options = options || {};

    if (!redis) {
      redis = require('redis');
    }

    /* -----------------------
     | 连接redis服务器
     | connect over tcp/ip
     | -----------------------
    */
    cxn = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'), options);

    cxn.on('error', function (err) {
      winston.error(err.stack);
      process.exit(1);
    });

    if (nconf.get('redis:password')) {
      cxn.auth(nconf.get('redis:password'));
    }

    dbIdx = parseInt(nconf.get('redis:database'), 10);
    if (dbIdx) {
      cxn.select(dbIdx, function(error) {
        if(error) {
          winston.error("ChatRoom could not connect to your Redis database. Redis returned the following error: " + error.message);
          process.exit();
        }
      });
    }

    return cxn;
  };

  module.close = function() {
    redisClient.quit();
  };

}(exports));

