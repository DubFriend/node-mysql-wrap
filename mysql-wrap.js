var _ = require('underscore');
var Q = require('q');

var MySQLWrapError = function (error) {
    Error.captureStackTrace(this);
    this.statusCode = 400;
    this.message = _.last(new Error(error).message.split(':')).trim();
    this.name = 'MySQLWrapError';
    this.errno = error.errno;
    this.code = error.code;
    this.sqlState = error.sqlState;
    this.index = error.index;
    this.indexName = _.last(this.message.split(' ')).replace(/'/g, '');
};

MySQLWrapError.prototype = Object.create(Error.prototype);

var createMySQLWrap = function (connection, options) {
    'use strict';

    options = options || {};

    var self = {};

    var transactionConn = null;

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

    var isMysqlError = function (error) {
        return error instanceof Error && error.code;
    };

    var respond = function (def, callback, err, res) {
        var wrappedError = isMysqlError(err) ? new MySQLWrapError(err) : err;
        callback(wrappedError, res);
        promiseRespond(def, wrappedError, res);
    };

    var stripLimit = function (sql) {
        return sql.replace(/ LIMIT .*/i, '');
    };

    var paginateLimit = function (fig) {
        return fig ?
            'LIMIT ' + fig.resultsPerPage +
            ' OFFSET ' + ((fig.page - 1) * fig.resultsPerPage) : '';
    };

    var getStatementObject = function (statementOrObject) {
        var statement = _.isObject(statementOrObject) ?
            statementOrObject : {
                sql: statementOrObject,
                nestTables: false
            };

        if(statement.paginate) {
            statement.sql = stripLimit(statement.sql) + ' ' +
                            paginateLimit(statement.paginate);
        }

        return statement;
    };

    var getConnection = function (readOrWrite, callback) {
        if(transactionConn) {
            callback(null, transactionConn);
        }
        else {
            if(connection.getConnection) {
                if(options.replication) {
                    connection.getConnection(options.replication[readOrWrite], callback);
                }
                else {
                    connection.getConnection(callback);
                }
            }
            else {
                callback(null, connection);
            }
        }
    };

    self.query = function (sqlOrObject, valuesOrCallback, callbackOrNothing) {
        var statement = getStatementObject(sqlOrObject),
            values = getValueFromParams(valuesOrCallback, callbackOrNothing),
            callback = getCallBackFromParams(valuesOrCallback, callbackOrNothing),
            def = Q.defer(),
            readOrWrite = function () {
                return /^SELECT/i.test(statement.sql.trim()) ? 'read' : 'write';
            };

        getConnection(readOrWrite(), function (err, conn) {
            if(err) {
                respond(def, callback, err, null);
            }
            else {
                conn.query(statement, values, function(err, rows){
                    respond(def, callback, err, rows);
                    if (!transactionConn && conn.release) {
                        conn.release();
                    }
                });
            }
        });

        return def.promise;
    };

    self.one = function (sqlOrObject, valuesOrCallback, callbackOrNothing) {
        var statement = getStatementObject(sqlOrObject),
            values = getValueFromParams(valuesOrCallback, callbackOrNothing),
            callback = getCallBackFromParams(valuesOrCallback, callbackOrNothing),
            def = Q.defer();

        statement.sql = / LIMIT /.test(statement.sql.toUpperCase) ?
                        statement.sql : statement.sql + ' LIMIT 1';

        self.query(statement, values, function (err, res) {
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

    var selectedFieldsSQL = function (fields) {
        return fields ? fields.join(', ') : '*';
    };

    self.select = function (tableOrObject, whereEquals, callback) {
        var statement = _.isObject(tableOrObject) ?
            tableOrObject : { table: tableOrObject };

        var where = prepareWhereEquals(whereEquals);
        var values = [statement.table].concat(where.values);
        return self.query(
            'SELECT ' + selectedFieldsSQL(statement.fields) + ' FROM ?? ' + where.sql +
            (statement.paginate ? ' ' + paginateLimit(statement.paginate) : ''),
            values,
            callback
        );
    };

    self.selectOne = function (tableOrObject, whereEquals, callback) {
        var statement = _.isObject(tableOrObject) ?
            tableOrObject : { table: tableOrObject };

        var where = prepareWhereEquals(whereEquals);
        var values = [statement.table].concat(where.values);

        return self.one(
            'SELECT ' + selectedFieldsSQL(statement.fields) +
            ' FROM ?? ' + where.sql,
            values,
            callback
        );
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

    self.end = function (callback) {
        var def = Q.defer();
        connection.end(_.partial(respond, def, callback || function () {}));
        return def.promise;
    };

    self.destroy = connection.destroy;
    self.release = connection.release;

    self.changeUser = function (fig, callback) {
        var def = Q.defer();
        connection.changeUser(
            fig, _.partial(respond, def, callback || function () {})
        );
        return def.promise;
    };

    self.beginTransaction = function (callback) {

        var def = Q.defer();

        getConnection('write', function (err, conn) {
            transactionConn = conn;
            if(err) {
                respond(def, callback, err);
            }
            else {
                conn.beginTransaction(_.partial(
                    respond, def, callback || function () {}
                ));
            }
        });

        return def.promise;
    };

    self.rollback = function (callback) {
        var def = Q.defer();

        getConnection('write', function (err, conn) {
            conn.rollback(function(err){
                if(conn.release) {
                    conn.release();
                }
                transactionConn = null;
                respond(def, callback || function () {}, err);
            });
        });

        return def.promise;
    };

    self.commit = function (callback) {
        var def = Q.defer();

        getConnection('write', function (err, conn) {
            conn.commit(function () {
                if(conn.release) {
                    conn.release();
                }
                transactionConn = null;
                respond(def, callback || function () {}, err);
            });
        });

        return def.promise;
    };

    return self;
};

createMySQLWrap.Error = MySQLWrapError;

module.exports = createMySQLWrap;
