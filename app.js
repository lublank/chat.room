"use strict";
/*global require, global, process*/

var nconf = require('nconf');
nconf.argv().env('__');

var url = require('url'),
    fs = require('fs'),
    async = require('async'),
    winston = require('winston'),
    colors = require('colors'),
    path = require('path'),
    pkg = require('./package.json');

global.env = process.env.NODE_ENV || 'production';

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
    colorize: true,
    timestamp: function() {
        var date = new Date();
        return date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.toTimeString().substr(0,5) + ' [' + global.process.pid + ']';
    },
    level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose')
});

// Alternate configuration file support
var configFile = path.join(__dirname, '/config.json');
var configExists;

if (nconf.get('config')) {
    configFile = path.resolve(__dirname, nconf.get('config'));
}
configExists = fs.existsSync(configFile);

if (configExists) {
    start();
}

function loadConfig() {
    winston.info('[app] Load Configration in ' + configFile);

    nconf.file({
        file: configFile
    });

    /*
     |-------------------------------
     | 配置config自定义属性默认值
     |-------------------------------
     */
    nconf.defaults({
        base_dir: __dirname,
        views_dir: path.join(__dirname, 'resources/views'),
        version: pkg.version
    });

    if (!nconf.get('isCluster')) {
        nconf.set('isPrimary', 'true');
        nconf.set('isCluster', 'false');
    }

    if (!process.send) {
        // If run using `node app`, log GNU copyright info along with server info
        winston.info('SosoBtc v' + nconf.get('version') + ' Copyright (C) 2016 SosoBtc Inc.');
        winston.info('');
    }
}

/*
 |----------------------------
 | 程序启动
 |----------------------------
 */
function start(){
    loadConfig();

    var urlObject = url.parse(nconf.get('url'));
    var relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
    /*
     |---------------------------
     | 添加和设置config属性值
     |---------------------------
     */
    nconf.set('use_port', !!urlObject.port);
    nconf.set('relative_path', relativePath);
    nconf.set('port', urlObject.port || nconf.get('port') || nconf.get('PORT') || 4567);

    /*
     |---------------------------
     | 判断是否为主进程
     |---------------------------
     */
    if (nconf.get('isPrimary') === 'true') {
        winston.info('Time: %s', (new Date()).toString());
        winston.info('Initializing SosoBtc v%s', nconf.get('version'));
        winston.verbose('* using configuration stored in: %s', configFile);
    }

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', restart);

    /*
     |----------------------------
     | 有未捕获异常，关闭服务器
     |----------------------------
     */
    process.on('uncaughtException', function(err) {
        winston.error(err.stack);
        console.log(err.stack);

        shutdown(1);
    });

    /*
     |----------------------------
     | 瀑布流顺序执行并传递回调函数，
     | 初始化database
     | 初始化Http服务器
     | 初始化socket.io
     |----------------------------
     */
    async.waterfall([
        function(next) {
            require('./database').init(next);
        },
        //function(next) {
        //    require('./meta').configs.init(next);
        //},
        function(next) {
            var webserver = require('./src/webserver');
            require('./socket.io').init(webserver.server);

            webserver.listen();
        }
    ], function(err) {
        if (err) {
            winston.error(err.stack);
            process.exit();
        }
    });
}

/*
 |-------------------------------
 | 关闭redis数据库和http服务器
 |-------------------------------
 */
function shutdown(code) {
    winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
    require('./database').close();
    //winston.info('[app] Database connection closed.');
    require('./src/webserver').server.close();
    winston.info('[app] Web server closed to connections.');

    winston.info('[app] Shutdown complete.');
    process.exit(code || 0);
}

/*
 |-------------------------------
 | 重新启动
 |-------------------------------
 */
function restart() {
    if (process.send) {
        winston.info('[app] Restarting...');
        process.send({
            action: 'restart'
        });
    } else {
        winston.error('[app] Could not restart server. Shutting down.');
        shutdown(1);
    }
}
