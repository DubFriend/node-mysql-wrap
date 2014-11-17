var _ = require('underscore');
var configuration = require('../configuration');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: configuration.database.host,
    user: configuration.database.user,
    password: configuration.database.password,
    database: configuration.database.name
});
var createNodeMySQL = require('../mysql-wrap');

exports.setUp = function (done) {

    this.sql = createNodeMySQL(mysql.createPool({
        host: configuration.database.host,
        user: configuration.database.user,
        password: configuration.database.password,
        database: configuration.database.name
    }));

    connection.query('TRUNCATE TABLE `table`', function (err, res) {
        connection.query(
            'INSERT INTO `table` (`unique`, `field`) ' +
            'VALUES ("a", "foo"), ("b", "bar"), ("c", "foo")',
            function (err, res) {
                connection.query('TRUNCATE TABLE `table2`', function (err, res) {
                    connection.query(
                        'INSERT INTO `table2` (`field`) ' +
                        'VALUES ("bar")',
                        function () {
                            done();
                        }
                    );
                });
            }
        );
    });
};

_.each(require('./shared_tests.js')(connection, createNodeMySQL), function (test, name) {
    exports[name] = test;
});