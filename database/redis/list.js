"use strict";

module.exports = function(redisClient, module) {
	//将一个或多个值 value 插入到列表 key 的表头
	module.listPrepend = function(key, value, callback) {
		redisClient.lpush(key, value, callback);
	};

	//将一个或多个值 value 插入到列表 key 的表尾(最右边)。
	module.listAppend = function(key, value, callback) {
		redisClient.rpush(key, value, callback);
	};

	//移除并返回列表 key 的尾元素。
	module.listRemoveLast = function(key, callback) {
		redisClient.rpop(key, callback);
	};

	//根据参数 count 的值，移除列表中与参数 value 相等的元素。
	module.listRemoveAll = function(key, value, callback) {
		redisClient.lrem(key, 0, value, callback);
	};

	//返回列表 key 中指定区间内的元素，区间以偏移量 start 和 stop 指定。
	module.getListRange = function(key, start, stop, callback) {
		redisClient.lrange(key, start, stop, callback);
	};

	//对一个列表进行修剪(trim)，就是说，让列表只保留指定区间内的元素，不在指定区间之内的元素都将被删除。
	module.listTrim = function(key, start, stop, callback) {
		redisClient.ltrim(key, start, stop, callback);
	};
};