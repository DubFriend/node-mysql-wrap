var _ = require('underscore');
var Q = require('q');

module.exports = function (connection, mysql) {
    'use strict';

    var self = {};

    var getQueryType = function (statement) {
        var pieces = statement.trim().split(' ');
        return pieces[0].toUpperCase();
    };

    var promiseRespond = function (def, err, res) {
        if(err) {
            def.reject(err);
        }
        else {
            def.resolve(res);
        }
    };

    var getRowCountForSelectQuery = function (statement, values, callback) {
        // removes the "SELECT" and "LIMIT" portions of the query.
        var predicate = function () {
            return statement
                .replace(/.* FROM /i, '')
                .replace(/ LIMIT .*/i, '');
        };

        var def = Q.defer();

        connection.query(
            'SELECT COUNT(*) FROM ' + predicate(),
            function (err, res) {
                var rowCount = null;
                if(!err) {
                    rowCount = res[0]['COUNT(*)'];
                }

                promiseRespond(def, err, rowCount);
                if(callback) {
                    callback(err, rowCount);
                }
            }
        );

        return def.promise;
    };

    var getValueFromParams = function (valuesOrCallback, callbackOrNothing) {
        return _.isArray(valuesOrCallback) ? valuesOrCallback : [];
    };

    var getCallBackFromParams = function (valuesOrCallback, callbackOrNothing) {
        return _.isFunction(valuesOrCallback) ?
            valuesOrCallback : _.isFunction(callbackOrNothing) ?
                callbackOrNothing : function () {};
    };

    self.query = function (statement, valuesOrCallback, callbackOrNothing) {
        var values = getValueFromParams(valuesOrCallback, callbackOrNothing);
        var callback = getCallBackFromParams(valuesOrCallback, callbackOrNothing);
        var def = Q.defer();

        var respond = function (err, res) {
            var wrapResponse = function (res) {

                var wrapped = {};

                switch(getQueryType(statement)) {
                    case 'SELECT':
                        wrapped.results = res;
                        wrapped.count = _.partial(
                            getRowCountForSelectQuery,
                            statement,
                            values
                        );
                        break;
                    case 'INSERT':
                        wrapped = res;
                        break;
                    case 'UPDATE':
                        wrapped = res;
                        break;
                    case 'DELETE':
                        wrapped = res;
                        break;
                    default:
                        wrapped = res;
                }
                return wrapped;
            };

            callback(err, wrapResponse(res));
            promiseRespond(def, err, wrapResponse(res));
        };

        connection.query(statement, values, respond);

        return def.promise;
    };

    self.one = function (statement, valuesOrCallback, callbackOrNothing) {
        var values = getValueFromParams(valuesOrCallback, callbackOrNothing);
        var callback = getCallBackFromParams(valuesOrCallback, callbackOrNothing);
        var def = Q.defer();

        var limitedStatement = / LIMIT /.test(statement.toUpperCase) ?
            statement : statement + ' LIMIT 1';

        self.query(limitedStatement, values, function (err, res) {
            var results;
            if(res && res.results) {
                results = _.extend(res, {
                    results: res.results[0] || null
                });
            }
            callback(err, results);
            promiseRespond(def, err, results);
        });

        return def.promise;
    };

    var prepareWhereEquals = function (whereEquals) {
        var values = [];
        var sql = _.map(whereEquals, function (val, key) {
            values.push(key);
            values.push(val);
            return '?? = ?';
        }, '').join(' AND ');

        return {
            values: values,
            sql: sql ? ' WHERE ' + sql : sql
        };
    };

    self.select = function (table, whereEquals, callback) {
        var where = prepareWhereEquals(whereEquals);
        var values = [table].concat(where.values);
        return self.query('SELECT * FROM ?? ' + where.sql, values, callback);
    };

    self.selectOne = function (table, whereEquals, callback) {
        var where = prepareWhereEquals(whereEquals);
        var values = [table].concat(where.values);
        return self.one('SELECT * FROM ?? ' + where.sql, values, callback);
    };

    self.insert = function (table, rowOrRows, callback) {

    };

    self.update = function (table, setData, whereEquals, callback) {

    };

    self.delete = function (table, whereEquals, callback) {

    };

    return self;
};
