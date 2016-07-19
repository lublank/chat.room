'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	crypto = require('crypto'),
	async = require('async'),

	emitter = require('../emitter'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.css = {};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;
	Meta.css.branding = {};
	Meta.css.defaultBranding = {};

	Meta.css.minify = function(callback) {
		if (nconf.get('isPrimary') === 'true') {
			winston.verbose('[meta/css] Minifying LESS/CSS');
			var 
				paths = [
					path.join(__dirname, '../../resources/less'),
					path.join(__dirname, '../../public/vendor'),
					path.join(__dirname, '../../public/vendor/fontawesome/less'),
					path.join(__dirname, '../../public/vendor/bootstrap/less')
				],
				source = '@import "font-awesome";',
				acpSource,
				x;
			
			source += '\n@relative-path: "' + nconf.get('relative_path') + '";';
			source += '\n@import (inline) "./jquery-ui/jquery-ui.css";';
			source += '\n@import "./app";';

			acpSource = '\n@import "./reset";\n@import "./admin/admin";\n' + source;
			source = '\n@import "./bootstrap";\n@import "./reset";\n' + source;

			async.parallel([
				function(next) {
					minify(source, paths, 'cache', next);
				},
				function(next) {
					minify(acpSource, paths, 'acpCache', next);
				}
			], function(err, minified) {
				// Propagate to other workers
				if (process.send) {
					process.send({
						action: 'css-propagate',
						cache: minified[0],
						acpCache: minified[1],
						hash: Meta.css.hash
					});
				}

				emitter.emit('meta:css.compiled');

				if (typeof callback === 'function') {
					callback();
				}
			});
		} else {
			winston.verbose('[meta/css] Cluster worker ' + process.pid + ' skipping LESS/CSS compilation');
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.css.commitToFile = function(filename) {
		var file = (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css';

		fs.writeFile(path.join(__dirname, '../../public/dist/' + file), Meta.css[filename], function(err) {
			if (!err) {
				winston.verbose('[meta/css] ' + file + ' committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}
		});
	};

	Meta.css.getFromFile = function(callback) {
		var cachePath = path.join(__dirname, '../../public/stylesheet.css'),
			acpCachePath = path.join(__dirname, '../../public/admin.css');
		fs.exists(cachePath, function(exists) {
			if (exists) {
				if (nconf.get('isPrimary') === 'true') {
					winston.verbose('[meta/css] (Experimental) Reading stylesheets from file');
					async.map([cachePath, acpCachePath], fs.readFile, function(err, files) {
						Meta.css.cache = files[0];
						Meta.css.acpCache = files[1];

						emitter.emit('meta:css.compiled');
						callback();
					});
				} else {
					callback();
				}
			} else {
				winston.warn('[meta/css] (Experimental) No stylesheets found on disk, re-minifying');
				Meta.css.minify.apply(Meta.css, arguments);
			}
		});
	};

	function minify(source, paths, destination, callback) {
		less.render(source, {
			paths: paths,
			compress: true
		}, function(err, lessOutput) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			Meta.css[destination] = lessOutput.css;

			if (destination === 'cache') {
				// Calculate css buster
				var hasher = crypto.createHash('md5');

				hasher.update(lessOutput.css, 'utf-8');
				Meta.css.hash = hasher.digest('hex').slice(0, 8);
			}

			// Save the compiled CSS in public/ so things like nginx can serve it
			if (nconf.get('isPrimary') === 'true') {
				Meta.css.commitToFile(destination);
			}

			if (typeof callback === 'function') {
				callback(null, lessOutput.css);
			}
		});
	}

	function filterMissingFiles(files) {
		return files.filter(function(file) {
			var exists = fs.existsSync(path.join(__dirname, '../../node_modules', file));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + file);
			}
			return exists;
		});
	}
};