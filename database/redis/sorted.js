"use strict";

/*
 |----------------------------------------------
 | 有序集合数据库操作
 |----------------------------------------------
 */
module.exports = function(redisClient, module) {
	/*
	 |------------------------------------------------------------
	 | ZADD key score member [[score member] [score member] ...]
	 |------------------------------------------------------------
	 | 将一个或多个 member 元素及其 score 值加入到有序集 key 当中。
	 | 如果某个 member 已经是有序集的成员，那么更新这个 member 的 score 值，并通过重新插入这个 member 元素，来保证该 member 在正确的位置上。
	 | score 值可以是整数值或双精度浮点数。
	 | 如果 key 不存在，则创建一个空的有序集并执行 ZADD 操作。
	 | 当 key 存在但不是有序集类型时，返回一个错误。
	 | 对有序集的更多介绍请参见 sorted set 。
	 */
	module.sortedSetAdd = function(key, score, value, callback) {
		callback = callback || function() {};
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddMulti(key, score, value, callback);
		}
		redisClient.zadd(key, score, value, function(err) {
			callback(err);
		});
	};

	function sortedSetAddMulti(key, scores, values, callback) {
		if (!scores.length || !values.length) {
			return callback();
		}

		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var args = [key];

		for(var i=0; i<scores.length; ++i) {
			args.push(scores[i], values[i]);
		}

		redisClient.zadd(args, function(err, res) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function(keys, score, value, callback) {
		callback = callback || function() {};
		var multi = redisClient.multi();

		for(var i=0; i<keys.length; ++i) {
			multi.zadd(keys[i], score, value);
		}

		multi.exec(function(err, res) {
			callback(err);
		});
	};

	/*
	 |---------------------------------------------------------
	 | ZREM key member [member ...]
	 |---------------------------------------------------------
	 | 移除有序集 key 中的一个或多个成员，不存在的成员将被忽略。
	 | 当 key 存在但不是有序集类型时，返回一个错误。
	 */
	module.sortedSetRemove = function(key, value, callback) {
		callback = callback || function() {};
		if (!Array.isArray(value)) {
			value = [value];
		}
		var multi = redisClient.multi();
		for(var i=0; i<value.length; ++i) {
			multi.zrem(key, value[i]);
		}
		multi.exec(function(err) {
			callback(err);
		});
	};

	module.sortedSetsRemove = function(keys, value, callback) {
		multi('zrem', keys, value, function(err) {
			callback(err);
		});
	};

	/*
	 |----------------------------------------------------------------
	 | ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]
	 |----------------------------------------------------------------
	 | 返回有序集 key 中， score 值介于 max 和 min 之间(默认包括等于 max 或 min )的所有的成员。有序集成员按 score 值递减(从大到小)的次序排列。
	 | 具有相同 score 值的成员按字典序的逆序(reverse lexicographical order )排列。
	 | 除了成员按 score 值递减的次序排列这一点外， ZREVRANGEBYSCORE 命令的其他方面和 ZRANGEBYSCORE 命令一样。
	 */
	module.sortedSetsRemoveRangeByScore = function(keys, min, max, callback) {
		callback = callback || function() {};
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.zremrangebyscore(keys[i], min, max);
		}
		multi.exec(function(err) {
			callback(err);
		});
	};

	/*
	 |------------------------------------------------------------
	 | ZRANGE key start stop [WITHSCORES]
	 |------------------------------------------------------------
	 | 返回有序集 key 中，指定区间内的成员。
	 | 其中成员的位置按 score 值递增(从小到大)来排序。
	 | 具有相同 score 值的成员按字典序(lexicographical order )来排列。
	 | 如果你需要成员按 score 值递减(从大到小)来排列，请使用 ZREVRANGE 命令。
	 | 下标参数 start 和 stop 都以 0 为底，也就是说，以 0 表示有序集第一个成员，以 1 表示有序集第二个成员，以此类推。
	 | 你也可以使用负数下标，以 -1 表示最后一个成员， -2 表示倒数第二个成员，以此类推。
	 | 超出范围的下标并不会引起错误。
	 | 比如说，当 start 的值比有序集的最大下标还要大，或是 start > stop 时， ZRANGE 命令只是简单地返回一个空列表。
	 | 另一方面，假如 stop 参数的值比有序集的最大下标还要大，那么 Redis 将 stop 当作最大下标来处理。
	 | 可以通过使用 WITHSCORES 选项，来让成员和它的 score 值一并返回，返回列表以 value1,score1, ..., valueN,scoreN 的格式表示。
	 | 客户端库可能会返回一些更复杂的数据类型，比如数组、元组等。
	 */
	module.getSortedSetRange = function(key, start, stop, callback) {
		redisClient.zrange(key, start, stop, callback);
	};

	/*
	 |--------------------------------------------------
	 | ZREVRANGE key start stop [WITHSCORES]
	 |--------------------------------------------------
	 | 返回有序集 key 中，指定区间内的成员。
	 | 其中成员的位置按 score 值递减(从大到小)来排列。
	 | 具有相同 score 值的成员按字典序的逆序(reverse lexicographical order)排列。
	 | 除了成员按 score 值递减的次序排列这一点外， ZREVRANGE 命令的其他方面和 ZRANGE 命令一样。
	 */
	module.getSortedSetRevRange = function(key, start, stop, callback) {
		redisClient.zrevrange(key, start, stop, callback);
	};

	module.getSortedSetRangeWithScores = function(key, start, stop, callback) {
		sortedSetRangeWithScores('zrange', key, start, stop, callback);
	};

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		sortedSetRangeWithScores('zrevrange', key, start, stop, callback);
	};

	function sortedSetRangeWithScores(method, key, start, stop, callback) {
		redisClient[method]([key, start, stop, 'WITHSCORES'], function(err, data) {
			if (err) {
				return callback(err);
			}
			var objects = [];
			for(var i=0; i<data.length; i+=2) {
				objects.push({value: data[i], score: data[i+1]});
			}
			callback(null, objects);
		});
	}

	/*
	 |------------------------------------------------------------
	 | ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]
	 |------------------------------------------------------------
	 | 返回有序集 key 中，所有 score 值介于 min 和 max 之间(包括等于 min 或 max )的成员。有序集成员按 score 值递增(从小到大)次序排列。
	 | 具有相同 score 值的成员按字典序(lexicographical order)来排列(该属性是有序集提供的，不需要额外的计算)。
	 | 可选的 LIMIT 参数指定返回结果的数量及区间(就像SQL中的 SELECT LIMIT offset, count )，注意当 offset 很大时，定位 offset 的操作可能需要遍历整个有序集，此过程最坏复杂度为 O(N) 时间。
	 | 可选的 WITHSCORES 参数决定结果集是单单返回有序集的成员，还是将有序集成员及其 score 值一起返回。
	 */
	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		redisClient.zrangebyscore([key, min, max, 'LIMIT', start, count], callback);
	};

	/*
	 |----------------------------------------------------------------
	 | ZREVRANGEBYSCORE key max min [WITHSCORES] [LIMIT offset count]
	 |----------------------------------------------------------------
	 | 返回有序集 key 中， score 值介于 max 和 min 之间(默认包括等于 max 或 min )的所有的成员。有序集成员按 score 值递减(从大到小)的次序排列。
	 | 具有相同 score 值的成员按字典序的逆序(reverse lexicographical order )排列。
	 | 除了成员按 score 值递减的次序排列这一点外， ZREVRANGEBYSCORE 命令的其他方面和 ZRANGEBYSCORE 命令一样。
	 */
	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		redisClient.zrevrangebyscore([key, max, min, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRangeByScoreWithScores = function(key, start, count, min, max, callback) {
		sortedSetRangeByScoreWithScores('zrangebyscore', key, start, count, min, max, callback);
	};

	module.getSortedSetRevRangeByScoreWithScores = function(key, start, count, max, min, callback) {
		sortedSetRangeByScoreWithScores('zrevrangebyscore', key, start, count, max, min, callback);
	};

	function sortedSetRangeByScoreWithScores(method, key, start, count, min, max, callback) {
		redisClient[method]([key, min, max, 'WITHSCORES', 'LIMIT', start, count], function(err, data) {
			if (err) {
				return callback(err);
			}
			var objects = [];
			for(var i=0; i<data.length; i+=2) {
				objects.push({value: data[i], score: data[i+1]});
			}
			callback(null, objects);
		});
	}

	/*
	 |---------------------------------------------
	 | ZCOUNT key min max
	 |---------------------------------------------
	 | 返回有序集 key 中， score 值在 min 和 max 之间(默认包括 score 值等于 min 或 max )的成员的数量。
	 */
	module.sortedSetCount = function(key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	};

	/*
	 |---------------------------------------------
	 | ZCARD key
	 |---------------------------------------------
	 | 返回有序集 key 的基数。
	 | 当 key 存在且是有序集类型时，返回有序集的基数。
	 | 当 key 不存在时，返回 0 。
	 */
	module.sortedSetCard = function(key, callback) {
		redisClient.zcard(key, callback);
	};

	module.sortedSetsCard = function(keys, callback) {
		if (Array.isArray(keys) && !keys.length) {
			return callback(null, []);
		}
		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.zcard(keys[i]);
		}
		multi.exec(callback);
	};

	/*
	 |--------------------------------------------
	 | ZRANK key member
	 |--------------------------------------------
	 | 返回有序集 key 中成员 member 的排名。其中有序集成员按 score 值递增(从小到大)顺序排列。
	 | 排名以 0 为底，也就是说， score 值最小的成员排名为 0 。
	 | 使用 ZREVRANK 命令可以获得成员按 score 值递减(从大到小)排列的排名。
	 */
	module.sortedSetRank = function(key, value, callback) {
		redisClient.zrank(key, value, callback);
	};

	module.sortedSetsRanks = function(keys, values, callback) {
		var multi = redisClient.multi();
		for(var i=0; i<values.length; ++i) {
			multi.zrank(keys[i], values[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRanks = function(key, values, callback) {
		var multi = redisClient.multi();
		for(var i=0; i<values.length; ++i) {
			multi.zrank(key, values[i]);
		}
		multi.exec(callback);
	};

	/*
	 |-----------------------------------------------
	 | ZREVRANGE key start stop [WITHSCORES]
	 |-----------------------------------------------
	 | 返回有序集 key 中，指定区间内的成员。
	 | 其中成员的位置按 score 值递减(从大到小)来排列。
	 | 具有相同 score 值的成员按字典序的逆序(reverse lexicographical order)排列。
	 */
	module.sortedSetRevRank = function(key, value, callback) {
		redisClient.zrevrank(key, value, callback);
	};

	/*
	 |-----------------------------------------------
	 | ZSCORE key member
	 |-----------------------------------------------
	 | 返回有序集 key 中，成员 member 的 score 值。
	 | 如果 member 元素不是有序集 key 的成员，或 key 不存在，返回 nil 。
	 */
	module.sortedSetScore = function(key, value, callback) {
		redisClient.zscore(key, value, callback);
	};

	module.sortedSetsScore = function(keys, value, callback) {
		multi('zscore', keys, value, callback);
	};

	module.sortedSetScores = function(key, values, callback) {
		var multi = redisClient.multi();
		for(var i=0; i<values.length; ++i) {
			multi.zscore(key, values[i]);
		}
		multi.exec(callback);
	};

	//判断是否为管理员
	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, score);
		});
	};

	//判断多个管理员
	module.isSortedSetMembers = function(key, values, callback) {
		var multi = redisClient.multi();
		for (var i=0; i<values.length; ++i) {
			multi.zscore(key, values[i]);
		}
		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}
			results = results.map(function(score) {
				return !!score;
			});
			callback(null, results);
		});
	};

	function multi(command, keys, value, callback) {
		var	m = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			m[command](keys[x], value);
		}

		m.exec(callback);
	}

	module.getSortedSetUnion = function(sets, start, stop, callback) {
		sortedSetUnion(sets, false, start, stop, callback);
	};

	module.getSortedSetRevUnion = function(sets, start, stop, callback) {
		sortedSetUnion(sets, true, start, stop, callback);
	};

	function sortedSetUnion(sets, reverse, start, stop, callback) {
		var	multi = redisClient.multi();

		// zunionstore prep
		sets.unshift(sets.length);
		sets.unshift('temp');

		multi.zunionstore.apply(multi, sets);
		multi[reverse ? 'zrevrange' : 'zrange']('temp', start, stop);
		multi.del('temp');
		multi.exec(function(err, results) {
			callback(err, results ? results[1] : null);
		});
	}

	/*
	 |------------------------------------------------
	 | ZINCRBY key increment member
	 |------------------------------------------------
	 | 为有序集 key 的成员 member 的 score 值加上增量 increment 。
	 | 可以通过传递一个负数值 increment ，让 score 减去相应的值，比如 ZINCRBY key -5 member ，就是让 member 的 score 值减去 5 。
	 | 当 key 不存在，或 member 不是 key 的成员时， ZINCRBY key increment member 等同于 ZADD key increment member 。
	 | 当 key 不是有序集类型时，返回一个错误。
	 | score 值可以是整数值或双精度浮点数。
	 */
	module.sortedSetIncrBy = function(key, increment, value, callback) {
		redisClient.zincrby(key, increment, value, callback);
	};
};