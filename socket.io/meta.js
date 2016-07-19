'use strict';

var nconf = require('nconf'),
  winston = require('winston'),

  db = require('../database'),
  meta = require('../meta'),
  user = require('../user'),
  emitter = require('../emitter'),

  websockets = require('./'),

  SocketMeta = { };

emitter.on('sosobtc:ready', function() {
  websockets.emitAll('event:sosobtc.ready', {
    general: meta.config['cache-buster']
  });
});

module.exports = SocketMeta;