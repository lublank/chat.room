"use strict";

var nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	express = require('express'),

	controllers = require('../controllers');

function setupPageRoute(router, name, middleware, middlewares, controller) {

  router.get(name, middlewares, controller);
};

function setupAPIRoute(router, name, middleware, middlewares, controller) {

  router.get(name, middlewares, controller);
};

function setupPostRoute(router, name, middleware, middlewares, controller) {

  router.post(name, middlewares, controller);
};

function mainRoutes(app, middleware, controllers) {

	//页面路由
	//app.get('/:room?', controllers.chat);

	//********************添加中间件处理******************//
	setupPageRoute(app, '/:room?', middleware, [], controllers.chat);
	//生成验证码
	setupPageRoute(app, '/captcha/code', middleware, [], controllers.captcha.verify);
	//退出登录
	setupPageRoute(app, '/user/logout', middleware, [], controllers.user.logout);
	//用户列表
	setupPageRoute(app, '/user/list', middleware, [], controllers.list);
	//聊天列表
	setupPageRoute(app, '/chat/list/:room?', middleware, [], controllers.chatList.chatList);
	//房间列表
	setupPageRoute(app, '/room/list', middleware, [], controllers.rooms);

	//分词
	setupAPIRoute(app, '/api/split', middleware, [], controllers.room.wordSplit);

	//post请求
	//用户登录
	setupPostRoute(app, '/user/login', middleware, [], controllers.user.login);
	//用户注册
	setupPostRoute(app, '/user/register', middleware, [], controllers.user.register);
	//判断用户是否被禁言
	setupPostRoute(app, '/user/isBanned', middleware, [], controllers.user.isBan);
	//用户禁言
	setupPostRoute(app, '/user/ban', middleware, [], controllers.user.ban);
	//添加房间
	setupPostRoute(app, '/room/add', middleware, [], controllers.room.roomAdd);
	//删除房间
	setupPostRoute(app, '/room/delete', middleware, [], controllers.room.roomDel);
	//删除聊天消息
	setupPostRoute(app, '/user/delChat', middleware, [], controllers.user.delChat);

}

module.exports = function(app, middleware) {
	var router = express.Router(),
		relativePath = nconf.get('relative_path');

//	app.use(middleware.maintenanceMode);

	mainRoutes(router, middleware, controllers);

	//静态资源路由路径
	app.use(relativePath, express.static(path.join(__dirname, '../', 'public'), {
    maxAge: app.enabled('cache') ? 5184000000 : 0
  }));
	
	app.use(relativePath, router);
	
	handle404(app, middleware);
	handleErrors(app, middleware);

};

function handle404(app, middleware) {
	app.use(function(req, res, next) {

		var relativePath = nconf.get('relative_path');
		var	isClientScript = new RegExp('^' + relativePath + '\\/src\\/.+\\.js');
		var isEmojiImage = new RegExp('\\/emoji\\/.+\\.png');

		if (isEmojiImage.test(req.url)) {
      res.type('image/png').status(200).sendFile(path.join(__dirname, '../../public/images/emoji', '0.png'));
    } else if (isClientScript.test(req.url)) {
			res.type('text/javascript').status(200).send('');
		} else if (req.accepts('html')) {
			if (process.env.NODE_ENV === 'development') {
				winston.warn('Route requested but not found: ' + req.url);
			}

			res.status(404);

			if (res.locals.isAPI) {
				return res.json({path: req.path});
			}

			middleware.buildHeader(req, res, function() {
				res.render('404', {path: req.path});
			});
		} else {
			res.status(404).type('txt').send('Not found');
		}
	});
}

function handleErrors(app, middleware) {
	app.use(function(err, req, res, next) {
		if (err.code === 'EBADCSRFTOKEN') {
			winston.error(req.path + '\n', err.message)
			return res.sendStatus(403);
		}

		winston.error(req.path + '\n', err.stack);

		if (parseInt(err.status, 10) === 302 && err.path) {
			return res.locals.isAPI ? res.status(302).json(err.path) : res.redirect(err.path);
		}

		res.status(err.status || 500);

		if (res.locals.isAPI) {
			return res.json({path: req.path, error: err.message});
		} else {
			middleware.buildHeader(req, res, function() {
				res.render('500', {path: req.path, error: err.message});
			});
		}
	});
}

