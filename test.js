var _ = require('underscore');
var configuration = require('./configuration');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: configuration.database.host,
    user: configuration.database.user,
    password: configuration.database.password,
    database: configuration.database.name
});
var createNodeMySQL = require('./mysql-wrap');

var catchPromise = function (err) {
    console.log(err);
};

exports.setUp = function (done) {
    this.sql = createNodeMySQL(connection);
    connection.query('TRUNCATE TABLE `table`', function (err, res) {
        connection.query(
            'INSERT INTO `table` (`unique`, `field`) VALUES ' +
            '("a", "foo"), ("b", "bar"), ("c", "foo")',
            function (err, res) {
                done();
            }
        );
    });
};

exports.query_select = function (test) {
    test.expect(4);
    var self = this;
    self.sql.query('SELECT * FROM `table`')
    .then(function (res) {
        test.deepEqual(
            res.results,
            [
                { id: 1, unique: 'a', field: 'foo' },
                { id: 2, unique: 'b', field: 'bar' },
                { id: 3, unique: 'c', field: 'foo' }
            ],
            'no values or callback'
        );
        return self.sql.query('SELECT ?? FROM `table` WHERE id = ?', ['unique', 2]);

    })
    .then(function (res) {
        test.deepEqual(res.results, [{ unique: 'b' }], 'values, no callback');
        return self.sql.query('sElEcT id FRoM `table` Where id = ?', [3]);

    })
    .then(function (res) {
        test.deepEqual(res.results, [{ id: 3 }], 'sql is case insensitive');
        return self.sql.query('SELECT id FROM `table` WHERE id = 1', function (err, res) {
            test.deepEqual(res.results, [{ id: 1 }], 'callback no values');
            test.done();
        });
    })
    .catch(catchPromise);
};

exports.query_select_no_results = function (test) {
    test.expect(1);
    this.sql.query('SELECT * FROM `table` WHERE `field` = "wrong"')
    .then(function (res) {
        test.deepEqual(res.results, [], 'returns empty array');
        test.done();
    })
    .catch(catchPromise);
};

exports.query_select_count = function (test) {
    test.expect(2);
    var self = this;
    var responseObject = null;
    self.sql.query('SELECT * FROM `table` WHERE field = "foo" LIMIT 1')
    .then(function (res) {
        responseObject = res;
        return self.sql.query('SELECT * FROM `table`');
    })
    .then(function (res) {
        return responseObject.count();
    })
    .then(function (rowCount) {
        test.strictEqual(
            rowCount, 2,
            'count ignores LIMIT, and does not depend on being the latest query'
        );
        responseObject.count(function (err, rowCount) {
            test.strictEqual(rowCount, 2, 'takes callback');
            test.done();
        });
    })
    .catch(catchPromise);
};

exports.query_insert = function (test) {
    test.expect(3);
    var responseObject;
    this.sql.query(
        'INSERT INTO `table` (`unique`, `field`) ' +
        'VALUES ("testUniqueValue", "testFieldValue") '
    )
    .then(function (res) {
        test.strictEqual(res.affectedRows, 1, 'counts affectedRows, promise object');
        test.strictEqual(res.insertId, 4, 'insert id');
        connection.query(
            'SELECT * FROM `table` WHERE `field` = "testFieldValue"',
            function (err, res) {
                test.deepEqual(res, [{
                    id: 4, unique: "testUniqueValue", field: "testFieldValue"
                }], 'field inserted into database');
                test.done();
            }
        );
    })
    .catch(catchPromise);
};

exports.query_update = function (test) {
    test.expect(5);
    var self = this;
    self.sql.query('UPDATE `table` SET `field` = "edit" WHERE `field` = "foo"')
    .then(function (res) {
        test.strictEqual(res.affectedRows, 2, 'affectedRows all changed');
        test.strictEqual(res.changedRows, 2, 'changedRows all changed');
        return self.sql.query(
            'UPDATE `table` SET `field` = "edit" WHERE `field` = "edit"'
        );
    })
    .then(function (res) {
        test.strictEqual(res.affectedRows, 2, 'affectedRows none changed');
        test.strictEqual(res.changedRows, 0, 'changedRows none changed');
        connection.query(
            'SELECT * FROM `table` WHERE `field` = "edit"',
            function(err, rows) {
                test.deepEqual(rows, [
                    { id: 1, unique: 'a', field: 'edit' },
                    { id: 3, unique: 'c', field: 'edit' }
                ], 'fields are updated in database');
                test.done();
            }
        );
    })
    .catch(catchPromise);
};

exports.query_delete = function (test) {
    test.expect(2);
    this.sql.query('DELETE FROM `table` WHERE `field` = "foo"')
    .then(function (res) {
        test.strictEqual(
            res.affectedRows, 2,
            'responseObject returns # of affectedRows'
        );
        connection.query(
            'SELECT * FROM `table` WHERE `field` = "foo"',
            function(err, rows) {
                test.deepEqual(
                    rows, [],
                    'fields are deleted from database'
                );
                test.done();
            }
        );
    })
    .catch(catchPromise);
};

exports.one = function (test) {
    test.expect(3);
    var self = this;
    self.sql.one('SELECT `id` FROM `table`')
    .then(function (res) {
        test.deepEqual(res.results, { id: 1 }, 'only returns one result');
        return res.count();
    })
    .then(function (rowCountWithoutLimit) {
        test.strictEqual(rowCountWithoutLimit, 3, 'returns count');
        self.sql.one('SELECT `id` FROM `table`', function (err, res) {
            test.deepEqual(res.results, { id: 1 }, 'takes callback');
            test.done();
        });
    })
    .catch(catchPromise);
};

exports.select = function (test) {
    test.expect(2);
    var self = this;
    self.sql.select('table', { id: 3, field: 'foo' })
    .then(function (res) {
        test.deepEqual(
            res.results, [{ id: 3, unique: 'c', field: 'foo' }],
            'promise'
        );
        self.sql.select('table', { id: 3, field: 'foo' }, function (err, res) {
            test.deepEqual(
                res.results, [{ id: 3, unique: 'c', field: 'foo' }],
                'callback'
            );
            test.done();
        });
    })
    .catch(catchPromise);
};

exports.selectOne = function (test) {
    test.expect(2);
    var self = this;
    self.sql.selectOne('table', { field: 'foo' })
    .then(function (res) {
        test.deepEqual(
            res.results, { id: 1, unique: 'a', field: 'foo' },
            'promise'
        );
        self.sql.selectOne('table', { field: 'foo' }, function (err, res) {
            test.deepEqual(
                res.results, { id: 1, unique: 'a', field: 'foo' },
                'callback'
            );
            test.done();
        });
    })
    .catch(catchPromise);
};

exports.insert_one_row = function (test) {
    test.expect(3);
    var self = this;
    self.sql.insert('table', { unique: 'd', field: 'baz' })
    .then(function (res) {
        test.strictEqual(res.affectedRows, 1, 'returns affectedRows');
        test.strictEqual(res.insertId, 4, 'returns insert id');
        connection.query(
            'SELECT * FROM `table` WHERE `id` = 4',
            function (err, res) {
                test.deepEqual(res, [
                    { id: 4, unique: 'd', field: 'baz' }
                ], 'inserts into database');
                test.done();
            }
        );
    })
    .catch(catchPromise);
};

exports.insert_multi_row = function (test) {
    test.expect(3);
    var self = this;
    self.sql.insert('table', [
        { unique: 'd', field: 'new' },
        { unique: 'e', field: 'new' }
    ])
    .then(function (res) {
        test.strictEqual(res.affectedRows, 2, 'returns affectedRows');
        test.strictEqual(res.insertId, 4, 'returns first insert id');
        connection.query(
            'SELECT * FROM `table` WHERE `field` = "new"',
            function (err, res) {
                test.deepEqual(res, [
                    { id: 4, unique: 'd', field: 'new' },
                    { id: 5, unique: 'e', field: 'new' }
                ], 'inserts into database');
                test.done();
            }
        );
    })
    .catch(catchPromise);
};

exports.update = function (test) {
    test.expect(1);
    var self = this;
    self.sql.update('table', { field: 'edit', unique: 'd' }, { id: 1 })
    .then(function (res) {
        connection.query(
            'SELECT * FROM `table`',
            function (err, res) {
                test.deepEqual(res, [
                    { id: 1, unique: 'd', field: 'edit' },
                    { id: 2, unique: 'b', field: 'bar' },
                    { id: 3, unique: 'c', field: 'foo' }
                ], 'updates database');
                test.done();
            }
        );
    });
};

exports.delete = function (test) {
    test.expect(1);
    var self = this;
    self.sql.delete('table', { id: 1 })
    .then(function (res) {
        connection.query(
            'SELECT * FROM `table`',
            function (err, res) {
                test.deepEqual(res, [
                    { id: 2, unique: 'b', field: 'bar' },
                    { id: 3, unique: 'c', field: 'foo' }
                ], 'deleted from database');
                test.done();
            }
        );
    });
};

exports.unique_constraint_error = function (test) {
    test.expect(2);
    this.sql.insert('table', { unique: 'a'})
    .catch(function (err) {
        console.log(err);
        test.strictEqual(err.code, 'ER_DUP_ENTRY', 'error code');
        test.strictEqual(err.indexName, 'unique', 'index name');
        test.done();
    });
};
