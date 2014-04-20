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

    self.query = function (statement, valuesOrCallback, callbackOrNothing) {
        var values = _.isArray(valuesOrCallback) ? valuesOrCallback : [];

        var callback = _.isFunction(valuesOrCallback) ?
            valuesOrCallback : _.isFunction(callbackOrNothing) ?
                callbackOrNothing : function () {};

        var def = Q.defer();

        var respond = function (err, res) {
            var wrapResponse = function (res) {
                // return res;
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
                        // wrapped.count = function () {
                        //     return res.
                        // }
                        break;
                    case 'UPDATE':
                        break;
                    case 'DELETE':
                        break;
                    default:

                }
                return wrapped;
            };
            callback(err, wrapResponse(res));
            promiseRespond(def, err, wrapResponse(res));
        };

        connection.query(statement, values, respond);

        return def.promise;
    };

    self.one = function (statement, values, callback) {

    };

    self.select = function (table, whereEquals, callback) {

    };

    self.selectOne = function (table, whereEquals, callback) {

    };

    self.insert = function (table, rowOrRows, callback) {

    };

    self.update = function (table, setData, whereEquals, callback) {

    };

    self.delete = function (table, whereEquals, callback) {

    };

    // gets the affected row count for the last executed query.
    self.count = function () {

    };

    return self;
};
