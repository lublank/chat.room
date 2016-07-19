(function(module) {
	'use strict';

	var utils, fs, XRegExp;

	if ('undefined' === typeof window) {
		fs = require('fs');

		process.profile = function(operation, start) {
			console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
		};

		process.elapsedTimeSince = function(start) {
			var diff = process.hrtime(start);
			return diff[0] * 1e3 + diff[1] / 1e6;
		};

	}



	module.exports = utils = {
		formatMsg: function(msg){
			msg = msg || '';
			/*
			 |---------------------------------------------------
			 | replace第二个参数为函数的规定：
			 |
			 | 第一个参数为每次匹配的全文本（$&）。
			 | 第二个参数为子表达式匹配字符串，个数不限.( $i (i:1-99))
			 | 第三个参数为匹配文本字符串的匹配下标位置。
			 | 最后一个参数表示字符串本身。
			 */

			//HTML转义
			msg = msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');

			//表情字符转换
			var pids = [];
			msg = msg.replace(/\[([1-9]|[1-9][0-9]|[1][0-3][1])\]/g, function(str, p1, pid){
				pids.push(pid);
				var img = str.replace(/\[|\]/g, '');
				return "<img class='face' src='/images/emoji/"+img+".png' />";
			});

			return msg;

		},
	  
		generateUUID: function() {
			return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
				var r = Math.random() * 16 | 0,
					v = c === 'x' ? r : (r & 0x3 | 0x8);
				return v.toString(16);
			});
		},

		//Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
		walk: function(dir, done) {
			var results = [];

			fs.readdir(dir, function(err, list) {
				if (err) {
					return done(err);
				}
				var pending = list.length;
				if (!pending) {
					return done(null, results);
				}
				list.forEach(function(file) {
					file = dir + '/' + file;
					fs.stat(file, function(err, stat) {
						if (stat && stat.isDirectory()) {
							utils.walk(file, function(err, res) {
								results = results.concat(res);
								if (!--pending) {
									done(null, results);
								}
							});
						} else {
							results.push(file);
							if (!--pending) {
								done(null, results);
							}
						}
					});
				});
			});
		}
	};

	if (typeof String.prototype.startsWith != 'function') {
		String.prototype.startsWith = function (prefix){
			if (this.length < prefix.length) {
				return false;
			}
			for (var i = prefix.length - 1; (i >= 0) && (this[i] === prefix[i]); --i) {
				continue;
			}
			return i < 0;
		};
	}

	if (typeof String.prototype.endsWith != 'function') {
		String.prototype.endsWith = function(suffix) {
			if (this.length < suffix.length) {
				return false;
			}
			var len = this.length;
			var suffixLen = suffix.length;
			for (var i=1; (i <= suffixLen && this[len - i] === suffix[suffixLen - i]); ++i) {
				continue;
			}
			return i > suffixLen;
		};
	}

	if ('undefined' !== typeof window) {
		window.utils = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);
