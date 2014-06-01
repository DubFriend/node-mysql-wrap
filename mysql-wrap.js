var _ = require('underscore');
var Q = require('q');

module.exports = function (connection, mysql) {
    'use strict';

    var self = {};

    var promiseRespond = function (def, err, res) {
        if(err) {
            def.reject(err);
        }
        else {
            def.resolve(res);
        }
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
            var wrappedError = (function () {
                if(err) {
                    return _.extend(err, {
                        indexName: _.last(err.toString().split(' '))
                            .replace(/'/g, '')
                    });
                }
                else {
                    return null;
                }
            }());

            callback(wrappedError, res);
            promiseRespond(def, wrappedError, res);
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
            var result = res ? _.first(res) : null;
            callback(err, result);
            promiseRespond(def, err, result);
        });

        return def.promise;
    };

    var prepareWhereEquals = function (whereEquals) {
        var values = [];
        var sql = _.map(whereEquals, function (val, key) {
            values.push(key, val);
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
        var prepareInsertRows = function (rowOrRows) {
            var values = [];
            var fields = _.isArray(rowOrRows) ?
                _.keys(_.first(rowOrRows)) : _.keys(rowOrRows);
            // NOTE: It is important that fieldsSQL is generated before valuesSQL
            // (because the order of the values array would otherwise be incorrect)
            var fieldsSQL = '(' + _.map(fields, function (field) {
                values.push(field);
                return '??';
            }).join(', ') + ')';

            var processValuesSQL = function (row) {
                return '(' + _.map(fields, function (field) {
                    values.push(row[field]);
                    return '?';
                }) + ')';
            };

            var valuesSQL = _.isArray(rowOrRows) ?
                _.map(rowOrRows, processValuesSQL).join(', ') :
                processValuesSQL(rowOrRows);

            return {
                values: values,
                sql: fieldsSQL + ' VALUES ' + valuesSQL
            };
        };

        var rows = prepareInsertRows(rowOrRows);

        return self.query(
            'INSERT INTO ?? ' + rows.sql,
            [table].concat(rows.values),
            callback
        );
    };

    self.update = function (table, setData, whereEquals, callback) {
        var prepareSetRows = function (setData) {
            var values = [];
            var sql = ' SET ' + _.map(setData, function (val, key) {
                values.push(key, val);
                return '?? = ?';
            }).join(', ');
            return { values: values, sql: sql };
        };

        var set = prepareSetRows(setData);
        var where = prepareWhereEquals(whereEquals);
        var values = [table].concat(set.values).concat(where.values);
        return self.query('UPDATE ??' + set.sql + where.sql, values, callback);
    };

    self.delete = function (table, whereEquals, callback) {
        var where = prepareWhereEquals(whereEquals);
        var values = [table].concat(where.values);
        return self.query('DELETE FROM ?? ' + where.sql, values, callback);
    };

    return self;
};
