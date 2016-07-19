"use strict";

var	async = require('async'),
	winston = require('winston'),
	fs = require('fs'),
	path = require('path'),

	groups = require('../groups'),
	meta = require('../meta'),
	user = require('../user'),
	db = require('../database'),


	SocketAdmin = {
    user: require('./admin/user')
	};

SocketAdmin.before = function(socket, method, next) {
	if (!socket.uid) {
		return;
	}
	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (!err && isAdmin) {
			next();
		} else {
			winston.warn('[socket.io] Call to admin method ( ' + method + ' ) blocked (accessed by uid ' + socket.uid + ')');
		}
	});
};

SocketAdmin.reload = function(socket, data, callback) {
	if (process.send) {
		process.send({
			action: 'reload'
		});
	} else {
		meta.reload(callback);
	}
};

SocketAdmin.restart = function(socket, data, callback) {
	meta.restart();
};

module.exports = SocketAdmin;
