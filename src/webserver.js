'use strict';

var path = require('path'),
  fs = require('fs'),
  nconf = require('nconf'),
  express = require('express'),
  app = express(),
  server,
  winston = require('winston'),
  async = require('async'),

  middleware = require('../middleware'),
  routes = require('../routes'),
  emitter = require('./emitter');

/*
 |--------------------------------
 | 创建Http服务器
 |--------------------------------
 */
if (nconf.get('ssl')) {
  server = require('https').createServer({
    key: fs.readFileSync(nconf.get('ssl').key),
    cert: fs.readFileSync(nconf.get('ssl').cert)
  }, app);
} else {
  server = require('http').createServer(app);
}

module.exports.server = server;

server.on('error', function(err) {
  winston.error(err);
  if (err.code === 'EADDRINUSE') {
    winston.error('SosoBtc address in use, exiting...');
    process.exit(0);
  } else {
    throw err;
  }
});


module.exports.listen = function() {

  middleware = middleware(app);

  emitter.all(['meta:js.compiled', 'meta:css.compiled'], function() {
    winston.info('SosoBtc Ready');
    emitter.emit('sosobtc:ready');
  });
  
  listen();

  initialize(function(err) {
    if (err) {
      winston.error(err);
      process.exit();
    }
    if (process.send) {
      process.send({
        action: 'ready'
      });
    }
  });
};

function initialize(callback) {
  var skipJS, skipLess, fromFile = nconf.get('from-file') || '';

  if (fromFile.match('js')) {
    winston.info('[minifier] Minifying client-side JS skipped');
    skipJS = true;
  }

  if (fromFile.match('less')) {
    winston.info('[minifier] Compiling LESS files skipped');
    skipLess = true;
  }

  /*
   |------------------------------------
   | 调用路由
   |------------------------------------
   */
  routes(app, middleware);
}

function cacheStaticFiles(callback) {
  if (global.env !== 'development') {
    app.enable('cache');
    app.enable('minification');
  }

  // Configure cache-buster timestamp
  require('child_process').exec('git describe --tags', {
    cwd: path.join(__dirname, '../')
  }, function(err, stdOut) {
    if (!err) {
      meta.config['cache-buster'] = 'v=' + stdOut.trim();
      callback();
    } else {
      fs.stat(path.join(__dirname, '../package.json'), function(err, stats) {
        if (err) {
          return callback(err);
        }
        meta.config['cache-buster'] = 'v=' + new Date(stats.mtime).getTime();
        callback();
      });
    }
  });
}

function listen(callback) {
  var port = nconf.get('port');

  if (Array.isArray(port)) {
    if (!port.length) {
      winston.error('[startup] empty ports array in config.json');
      process.exit();
    }

    winston.warn('[startup] If you want to start sosobtc on multiple ports please use loader.js');
    winston.warn('[startup] Defaulting to first port in array, ' + port[0]);
    port = port[0];
    if (!port) {
      winston.error('[startup] Invalid port, exiting');
      process.exit();
    }
  }

  if (port !== 80 && port !== 443 && nconf.get('use_port') === false) {
    winston.info('Enabling \'trust proxy\'');
    app.enable('trust proxy');
  }

  if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
    winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
  }

  var isSocket = isNaN(port),
    args = isSocket ? [port] : [port, nconf.get('bind_address')],
    bind_address = ((nconf.get('bind_address') === "0.0.0.0" || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address')) + ':' + port,
    oldUmask;

  args.push(function(err) {
    if (err) {
      winston.info('[startup] SosoBtc was unable to listen on: ' + bind_address);
      process.exit();
    }

    winston.info('SosoBtc is now listening on: ' + (isSocket ? port : bind_address));
    if (oldUmask) {
      process.umask(oldUmask);
    }
  });

  // Alter umask if necessary
  if (isSocket) {
    oldUmask = process.umask('0000');
    module.exports.testSocket(port, function(err) {
      if (!err) {
        server.listen.apply(server, args);
      } else {
        winston.error('[startup] SosoBtc was unable to secure domain socket access (' + port + ')');
        winston.error('[startup] ' + err.message);
        process.exit();
      }
    });
  } else {
    server.listen.apply(server, args);
  }
}

module.exports.testSocket = function(socketPath, callback) {
  if (typeof socketPath !== 'string') {
    return callback(new Error('invalid socket path : ' + socketPath));
  }
  var net = require('net');
  async.series([
    function(next) {
      fs.exists(socketPath, function(exists) {
        if (exists) {
          next();
        } else {
          callback();
        }
      });
    },
    function(next) {
      var testSocket = new net.Socket();
      testSocket.on('error', function(err) {
        next(err.code !== 'ECONNREFUSED' ? err : null);
      });
      testSocket.connect({ path: socketPath }, function() {
        // Something's listening here, abort
        callback(new Error('port-in-use'));
      });
    },
    async.apply(fs.unlink, socketPath), // The socket was stale, kick it out of the way
  ], callback);
};


