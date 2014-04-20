var _ = require('underscore');
var configuration = require('./configuration');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: configuration.database.host,
    user: configuration.database.user,
    password: configuration.database.password,
    database: configuration.database.name
});
var sql = require('./nodemysql');

