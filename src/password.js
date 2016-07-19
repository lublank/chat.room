'use strict';

var nconf = require('nconf');

(function(module) {
  var secret = nconf.get('secureKey');
  
	var fork = require('child_process').fork;

	module.hash = function(password, secret, callback) {
	  if(typeof secret === 'function'){
	    callback = secret;
	    secret = undefined;
	  }
		forkChild({type: 'hash', password: password, secret: secret}, callback);
	};
	
	module.hmac = function(text, secret, callback) {
    if(typeof secret === 'function'){
      callback = secret;
      secret = undefined;
    }
    forkChild({type: 'hmac', text: text, secret: secret}, callback);
  };

	function forkChild(message, callback) {
	  
		var child = fork('./crypt', {
//				silent: true
			});

		child.on('message', function(msg) {
			if (msg.err) {
				return callback(new Error(msg.err));
			}

			callback(null, msg.result);
		});

		child.send(message);
	}

	return module;
})(exports);