'use strict';

var crypto = require('crypto');

process.on('message', function(msg) {
	if (msg.type === 'hash') {
		hashPassword(msg.password, msg.secret);
	}else if(msg.type === 'hmac') {
        hmacHashMD5(msg.text, msg.secret);
    }
});

function hashPassword(password, secret) {
	var hash = crypto.createHash('md5', secret).update(password).digest('hex');
	process.send({result: hash});
	process.disconnect();
}

function hmacHashMD5(text, secret) {
  var hash = crypto.createHmac('md5', secret).update(text).digest('hex');
  process.send({result: hash});
  process.disconnect();
}

