module.exports = function (connection, mysql) {
    var self = {};

    var getQueryType = function (statement) {
        var pieces = statement.trim().split(' ');
        return pieces[0].toUpperCase();
    };

    self.query = function (statement, valuesOrCallback, callbackOrNothing) {
        switch(getQueryType(statement)) {
            case 'SELECT':
                break;
            case 'INSERT':
                break;
            case 'UPDATE':
                break;
            case 'DELETE':
                break;
            default:
                break;
        }
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
