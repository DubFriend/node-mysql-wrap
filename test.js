var _ = require('underscore');
var configuration = require('./configuration');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: configuration.database.host,
    user: configuration.database.user,
    password: configuration.database.password,
    database: configuration.database.name
});
var createNodeMySQL = require('./nodemysql');

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

