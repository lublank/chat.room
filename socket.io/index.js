"use strict";

var db = require('../database'),
	SocketIO = require('socket.io'),
	socketioWildcard = require('socketio-wildcard')(),
	async = require('async'),
	fs = require('fs'),
	nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	extend = require('util')._extend,
	online = require('../src/online'),
	utils = require('../public/utils'),
    user = require('../src/user'),
    Segment = require('segment'),

	Sockets = {},
	nsps = [];

var io;

//--------------------------------
////在线用户
//var onlineUsers = [];
////当前在线人数
//var onlineCount = [];

Sockets.init = function(server) {

	console.log('------------------socket io init----------------------\n');
	io = new SocketIO({
		path: '/stream'
	});

	regNamespace(io, '/message', onConnection);

	io.listen(server, {
		transports: nconf.get('socket.io:transports')
	});

	Sockets.server = io;
};

Sockets.emitAll = function(){
  var args = [].slice.call(arguments);
  async.map(nsps, function(nsp, next){
    io.of(nsp).emit.apply(io.of(nsp), args);
  });
};

/*
 |-----------------------------------------
 | io注册一个新的命名空间
 |-----------------------------------------
 */
function regNamespace(io, nsp, nspConn){
	//nsp = nconf.get('relative_path') + nsp;
	nsps.push(nsp);

	io.of(nsp).use(socketioWildcard);
	//io.of(nsp).use(auth.authorize);

	io.of(nsp).on('connection', nspConn);
}
function onConnection(socket) {
	onConnect(socket);

	// see https://github.com/Automattic/socket.io/issues/1814 and
	// http://stackoverflow.com/questions/25830415/get-the-list-of-rooms-the-client-is-currently-in-on-disconnect-event
	socket.onclose = function(reason) {
		Object.getPrototypeOf(this).onclose.call(this, {reason: reason, rooms: extend({}, socket.rooms)});
	};

	/*
	 |-----------------------------------------
	 | socket.io断开时的操作
	 |-----------------------------------------
	 */
	socket.on('disconnect', function(data) {
		onDisconnect(socket, data);
	});

	//socket.on('*', function(payload) {
	//	//onMessage(socket, payload);
	//});
}

function onConnect(socket) {

	//监听新用户加入
	socket.on('login', function(obj){
		//将新加入用户的唯一标识当作socket的名称，后面退出的时候会用到
		socket.uid = obj.userid;
		socket.username = obj.username;
		socket.room = obj.room;
		socket.role = obj.role;

		/*
		 |-------------------------------------
		 | 更新在线用户列表
		 */
		addOnlineUser(socket, obj.room, obj.userid);
	});


	//监听用户发布聊天内容
	socket.on('message', function(msgObj){
		console.log(msgObj.username+'说：'+msgObj.content);

		//过滤词语
		//创建实例
		var segment = new Segment();
		// 使用默认的识别模块及字典，载入字典文件需要1秒，仅初始化时执行一次即可
		segment.useDefault();
		var result = segment.doSegment(msgObj.content);
		console.log(result);
		var msgResult = [];
		for(var i=0; i<result.length; i++){
			if(result[i].p == 2147483648){
				msgResult.push('*');
			}else {
				msgResult.push(result[i].w);
			}
		}

		//格式化数据
		msgObj.content = utils.formatMsg(msgResult.join(''));
		//将数据存入redis
		async.waterfall([function(next){
			//判断是否被禁言
			user.isBanned(msgObj.userid, function(err, isBanned){
				if(err){
					return console.log('获取数据失败');
				}
				if(isBanned){
					socket.emit('notice', {msg: '你已被管理员禁言，暂时无法发言'});
					return ;
				}else {
					next(null, isBanned);
				}
			});
		},function(isBanned, next){
			//hash 表存放自增量
			db.incrObjectField('MsgId', 'next.message.id', next);
		}, function(msgId, next){
			msgObj.id = msgId;
			console.log(msgObj.room);
			db.sortedSetAdd(msgObj.room, msgId, JSON.stringify(msgObj), function(err) {
				if (err) {
					//console.log('Error:' + err);
					return next(err);
				}

				next(null, msgObj);
			});
		}], function(err, msgObj){
			if(err){
				return console.log('Error:' + err);
			}

			//向房间里的所有客户端广播发布的消息
			socket.emit('message', msgObj);
			socket.to(msgObj.room).emit('message', msgObj);

		});

	});

	//监听用户切换频道
	socket.on('leave', function(obj){
		console.log('用户切换频道');
		socket.leave(obj.lastRoom);
		socket.join(obj.newRoom);
		var userId = obj.userid;

		//将切换频道的用户从房间列表中删除
		delOnlineUser(socket, obj.lastRoom, userId);

		//进入房间
		socket.room = obj.newRoom;
		//更新在线列表
		addOnlineUser(socket, obj.newRoom, obj.userid);

		//获取聊天消息
		async.waterfall([function(next){
			db.getSortedSetRange(obj.newRoom, 0, -1, function(err, res){
				if (err) {
					console.log('Error:' + err);
					//return;
				}
				//打印聊天消息
				console.dir(res);
				next(null, res);
			});
		}],function(err, chatData){
			if(err){
				console.log('Error:' + err);
				return ;
			}
			console.log('更新聊天');
			socket.emit('loadMsg', {chats: chatData});
		});
	});

	//右键菜单
	socket.on('context', function(obj){
		user.getUserFields(obj.uid, ['role'], function(err, u){
			var data = {};
			console.log('role:'+ u.role);
			var role = u.role == null? 2 : u.role;
			if(role == 2){
				user.isBanned(obj.uid, function(err, isBanned){
					if(err){
						return console.log('获取数据失败');
					}
					if(!isBanned){
						//判断是否为游客(ip)
						if(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.test(obj.uid)){
							data = {
								uid : obj.uid,
								items: {
									banned: {
										name: "禁言",
										event: 'banned'
									}
								}
							}
						}else{
							data = {
								uid : obj.uid,
								items: {
									banned: {
										name: "禁言",
										event: 'banned'
									},
									authorize: {
										name: "设置管理员",
										event: 'setMember'
									}
								}
							}
						}

					}else {
						data = {
							uid : obj.uid,
							items: {
								unbanned: {
									name: "撤销禁言",
									event: 'unbanned'
								}
							}
						}
					}
					socket.emit('context', data);

				});
			}else{
				data = {
					uid : obj.uid,
					items: {
						revoke: {
							name: "撤销管理员",
							event: 'revokeMember'
						}
					}
				};

				socket.emit('context', data);
			}

		});

	});

	//用户禁言
	socket.on('banned', function(obj){
		console.log('用户禁言'+obj);
		user.ban(obj, function(err, userData){
			console.log('178 line '+userData);
			if(err){
				console.log('Error:' + err);
				return ;
			}
			//返回广播
			var data = {
				userid: socket.uid,
				username: socket.username,
				role: socket.role,
				content: '用户' + userData + '已被禁言'
			};
			socket.emit('banned', data);//发给自己
			socket.to(socket.room).emit('banned', data);//发给房间里所有人
		});
	});
	//撤销用户禁言
	socket.on('unbanned', function(obj){
		console.log('撤销用户禁言'+obj);
		user.unban(obj, function(err, userData){
			if(err){
				console.log('Error:' + err);
				return ;
			}
			//返回广播
			var data = {
				userid: socket.uid,
				username: socket.username,
				role: socket.role,
				content: '用户' + userData + '已被撤销禁言'
			};
			socket.emit('banned', data);
			socket.to(socket.room).emit('banned', data);
		});
	});
	//设置管理员
	socket.on('setMember', function(obj){
		console.log('设置管理员'+obj);
		user.setAdmin(obj, function(err, userData){
			if(err){
				console.log('Error:' + err);
				return ;
			}
			//返回广播
			var data = {
				userid: socket.uid,
				username: socket.username,
				role: socket.role,
				content: '用户' + userData + '已被设置为管理员'
			};
			socket.emit('setMember', data);
			socket.to(socket.room).emit('setMember', data);
		});
	});
	//撤销管理员
	socket.on('revokeMember', function(obj){
		console.log('撤销管理员');
		user.revokeAdmin(obj, function(err, userData){
			if(err){
				console.log('Error:' + err);
				socket.emit('notice', {msg: '您无权限撤销该用户管理员'});
				return ;
			}
			//返回广播
			var data = {
				userid: socket.uid,
				username: socket.username,
				role: socket.role,
				content: '用户' + userData + '已被撤销管理员'
			};
			socket.emit('revokeMember', data);
			socket.to(socket.room).emit('revokeMember', data);
		});
	});

}

function onDisconnect(socket, data) {
	/*
	 |------------------------------------------------------------------------------
	 | 更新在线用户列表
	 */
	delOnlineUser(socket, socket.room, socket.uid);
}

function addOnlineUser(socket, room, userId){
	/*
	 |------------------------------------------------------------------------------
	 | 将用户连接数加一
	 */
	async.waterfall([function(next) {
		online.incOnlineField('room:' + room, 'user:' + userId, 1, next);
	},function(connect, next){
		online.getOnlineCount('room:' + room, next);
	}], function(err, count) {
		console.log("193："+count);
		if (err) {
			return console.log('Error:' + err);
		}

		//加入房间
		socket.join(room);
		/*
		 |-------------------------------------------------------------------------------
		 | 向所有客户端广播用户加入
		 | emit ：用来发射一个事件或者说触发一个事件，
		 | 第一个参数为事件名，
		 | 第二个参数为要发送的数据，
		 | 第三个参数为回调函数（一般省略，如需对方接受到信息后立即得到确认时，则需要用到回调函数）。
		 |-------------------------------------------------------------------------------
		 */
		socket.emit('login', {onlineCount: count});
		socket.to(room).emit('login', {
			onlineCount: count
		});
	});
}
function delOnlineUser(socket, room, userId){
	/*
	 |------------------------------------------------------------------------------
	 | 将退出的用户从在线列表中删除
	 | 将连接数减一
	 */
	async.waterfall([function(next) {
		online.incOnlineField('room:' + room, 'user:' + userId, -1, next);
	},function(connect, next){
		online.getOnlineCount('room:' + room, next);
	}, function (count, next) {
		console.log('224:'+count);//-----------------有问题，count数值不对！！！---------------------//
		next(null, count);
	}], function(err, count) {

		if (err) {
			return console.log('Error:' + err);
		}
		//向所有客户端广播用户退出
		console.log("231:"+room+" "+count);
		socket.to(room).emit('logout', {
			onlineCount: count
		});
	});
}
//--------------------------------

/* Exporting */
module.exports = Sockets;
