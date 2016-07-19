"use strict";

/*
 |------------------------------------------------
 | 哈希表数据库操作
 |------------------------------------------------
 */
module.exports = function(redisClient, module) {
	/*
	 |---------------------------------------------
	 | HMSET key field value [field value ...]
	 | 同时将多个 field-value (域-值)对设置到哈希表 key 中。
	 | 此命令会覆盖哈希表中已存在的域。
	 | 如果 key 不存在，一个空哈希表被创建并执行 HMSET 操作。
	 */
	module.setObject = function(key, data, callback) {
		callback = callback || function() {};
		redisClient.hmset(key, data, function(err) {
			callback(err);
		});
	};

	/*
	 |---------------------------------------------
	 | HSET key field value
	 | 将哈希表 key 中的域 field 的值设为 value 。
	 | 如果 key 不存在，一个新的哈希表被创建并进行 HSET 操作。
	 | 如果域 field 已经存在于哈希表中，旧值将被覆盖。
	 */
	module.setObjectField = function(key, field, value, callback) {
		callback = callback || function() {};
		redisClient.hset(key, field, value, function(err) {
			callback(err);
		});
	};

	/*
	 |---------------------------------------------
	 | HGETALL key
	 | 返回哈希表 key 中，所有的域和值。
	 | 在返回值里，紧跟每个域名(field name)之后是域的值(value)，所以返回值的长度是哈希表大小的两倍。
	 */
	//module.getObjectval = function(key, field, callback) {
	//	redisClient.hget(key, field, callback);
	//};

	module.getObject = function(key, callback) {
		redisClient.hgetall(key, callback);
	};

	module.getObjects = function(keys, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hgetall(keys[x]);
		}

		multi.exec(callback);
	};

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		module.getObjectsFields([key], fields, function(err, results) {
			callback(err, results ? results[0]: null);
		});
	};

	/*
	 |----------------------------------------------------
	 | HMGET key field [field ...]
	 | 返回哈希表 key 中，一个或多个给定域的值。
	 | 如果给定的域不存在于哈希表，那么返回一个 nil 值。
	 | 因为不存在的 key 被当作一个空哈希表来处理，所以对一个不存在的 key 进行 HMGET 操作将返回一个只带有 nil 值的表。
	 */
	module.getObjectsFields = function(keys, fields, callback) {
		if (!Array.isArray(fields) || !fields.length) {
			return callback(null, keys.map(function() { return {}; }));
		}
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hmget.apply(multi, [keys[x]].concat(fields));
		}

		function makeObject(array) {
			var obj = {};

			for (var i = 0, ii = fields.length; i < ii; ++i) {
				obj[fields[i]] = array[i];
			}
			return obj;
		}

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(makeObject);
			callback(null, results);
		});
	};

	/*
	 |-------------------------------------------
	 | HKEYS key
	 | 返回哈希表 key 中的所有域。
	 */
	module.getObjectKeys = function(key, callback) {
		redisClient.hkeys(key, callback);
	};

	/*
	 |-------------------------------------------
	 | HVALS key
	 | 返回哈希表 key 中所有域的值。
	 */
	module.getObjectValues = function(key, callback) {
		redisClient.hvals(key, callback);
	};

	/*
	 |--------------------------------------------
	 | HEXISTS key field
	 | 查看哈希表 key 中，给定域 field 是否存在。
	 |--------------------------------------------
	 | 返回值：
	 | 如果哈希表含有给定域，返回 1 。
	 | 如果哈希表不含有给定域，或 key 不存在，返回 0 。
	 */
	module.isObjectField = function(key, field, callback) {
		redisClient.hexists(key, field, function(err, exists) {
			callback(err, exists === 1);
		});
	};

	/*
	 |---------------------------------------------
	 | HDEL key field [field ...]
	 | 删除哈希表 key 中的一个或多个指定域，不存在的域将被忽略。
	 | 返回值：被成功移除的域的数量
	 */
	module.deleteObjectField = function(key, field, callback) {
		redisClient.hdel(key, field, callback);
	};

	/*
	 |---------------------------------------------
	 | HINCRBY key field increment
	 | 为哈希表 key 中的域 field 的值加上增量 increment 。
	 | 增量也可以为负数，相当于对给定域进行减法操作。
	 | 如果 key 不存在，一个新的哈希表被创建并执行 HINCRBY 命令。
	 | 如果域 field 不存在，那么在执行命令前，域的值被初始化为 0 。
	 | 对一个储存字符串值的域 field 执行 HINCRBY 命令将造成一个错误。
	 | 本操作的值被限制在 64 位(bit)有符号数字表示之内。
	 */
	module.incrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		redisClient.hincrby(key, field, value, callback);
	};

	/*
	 |------------------------------------------------
	 | HLEN KEY
	 | 返回哈希表 key 中域的数量。
	 | 当 key 不存在时，返回 0 。
	 */
	module.getObjectFieldsLen = function(key, callback) {
		redisClient.hlen(key, callback);
	}
};