'use strict';

var winston = require('winston'),
	fork = require('child_process').fork,
	path = require('path'),
	async = require('async'),
	nconf = require('nconf'),
	fs = require('fs'),

	emitter = require('../emitter'),
	utils = require('../../public/utils');

module.exports = function(Meta) {

	Meta.js = {
	    
	  /**
	   * 打包成libs.js的公用模块
	   * 默认加载在/public/vendor/路径下的库
	   * 以 . 或 .. 开始的路径将加载相对路径（相对/public/vendor/）下的库
	   * 只有在此指明的模块才被打包进libs.js
	   */
	  
	  libs: {
	    'jquery': 'jquery',
	    'jquery-ui': 'jquery-ui',
		'jquery-mousewheel': 'jquery-mousewheel',
		'socket.io-client': 'socket.io-client',
		'utils': '../utils'
	  }
	};

	Meta.js.loadEnties = function(callback) {
		var entriesPath = path.join(__dirname, '../../resources/assets/js/');

		utils.walk(entriesPath, function(err, entryFiles){
		  if (err) {
        return callback(err);
      }
		  entryFiles = entryFiles.map(function(file) {
        return file.replace(entriesPath, '');
      });
		  
		  Meta.js.entries = entryFiles;
		  
		  callback();
		});
	};

	Meta.js.minify = function(minify, callback) {
		if (nconf.get('isPrimary') === 'true') {
			var minifier = Meta.js.minifierProc = fork('minifier.js', {
			  cwd: path.join(__dirname, '../..')
			}),
				onComplete = function(err) {
					if (err) {
						winston.error('[meta/js] Minification failed: ' + err.message);
						process.exit(0);
					}

					winston.verbose('[meta/js] Minification complete');
					minifier.kill();
					
					emitter.emit('meta:js.compiled');

					if (typeof callback === 'function') {
						callback();
					}
				};

			minifier.on('message', function(message) {
				switch(message.type) {
				case 'end':
					onComplete();
					break;
				case 'hash':
					Meta.js.hash = message.payload;
					break;
				case 'error':
					winston.error('[meta/js] Could not compile client-side scripts! ' + message.payload);
					minifier.kill();
					if (typeof callback === 'function') {
						callback(new Error(message.payload));
					} else {
						process.exit(0);
					}
					break;
				}
			});

			Meta.js.loadEnties(function(err){
			  if(err){
			    return callback(err);
			  }
			  minifier.send({
          action: 'js',
          minify: global.env !== 'development',
          entries: Meta.js.entries,
          libs: Meta.js.libs
        });
			});
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.js.killMinifier = function(callback) {
		if (Meta.js.minifierProc) {
			Meta.js.minifierProc.kill('SIGTERM');
		}
	};
};