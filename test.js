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
    });
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
    test.expect(2);
    var responseObject;
    this.sql.query(
        'INSERT INTO `table` (`unique`, `field`) ' +
        'VALUES ("testUniqueValue", "testFieldValue") '
    )
    .then(function (res) {
        test.strictEqual(res.affectedRows, 1, 'counts affectedRows, promise object');
        connection.query(
            'SELECT * FROM `table` WHERE `field` = "testFieldValue"',
            function (err, res) {
                test.deepEqual(res, [{
                    id: 4, unique: "testUniqueValue", field: "testFieldValue"
                }], 'field inserted into database');
                test.done();
            }
        );
    });
};

exports.query_update = function (test) {
    test.expect(2);
    this.sql.query('UPDATE `table` SET `field` = "edit" WHERE `field` = "foo"')
    .then(function (res) {
        test.strictEqual(
            res.affectedRows, 2,
            'responseObject returns # of affectedRows'
        );
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
    });
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
    });
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
    });
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
    });
};
