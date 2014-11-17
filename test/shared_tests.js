var _ = require('underscore');
module.exports = function (connection, createNodeMySQL) {
    var self = {};
    self.query_select = function (test) {
        test.expect(4);
        var self = this;
        self.sql.query('SELECT * FROM `table`')
        .then(function (res) {
            test.deepEqual(
                res,
                [
                    { id: 1, unique: 'a', field: 'foo' },
                    { id: 2, unique: 'b', field: 'bar' },
                    { id: 3, unique: 'c', field: 'foo' }
                ],
                'no values or callback'
            );

            return self.sql.query(
                'SELECT ?? FROM `table` WHERE id = ?',
                ['unique', 2]
            );
        })
        .then(function (res) {
            test.deepEqual(res, [{ unique: 'b' }], 'values, no callback');
            return self.sql.query('sElEcT id FRoM `table` Where id = ?', [3]);
        })
        .then(function (res) {
            test.deepEqual(res, [{ id: 3 }], 'sql is case insensitive');
            return self.sql.query(
                'SELECT id FROM `table` WHERE id = 1',
                function (err, res) {
                    test.deepEqual(res, [{ id: 1 }], 'callback no values');
                    test.done();
                }
            );
        })
        .done();
    };

    self.query_select_no_results = function (test) {
        test.expect(1);
        this.sql.query('SELECT * FROM `table` WHERE `field` = "wrong"')
        .then(function (res) {
            test.deepEqual(res, [], 'returns empty array');
            test.done();
        })
        .done();
    };

    self.query_insert = function (test) {
        test.expect(3);
        var responseObject;
        this.sql.query(
            'INSERT INTO `table` (`unique`, `field`) ' +
            'VALUES ("testUniqueValue", "testFieldValue") '
        )
        .then(function (res) {
            test.strictEqual(res.affectedRows, 1, 'affectedRows');
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
        .done();
    };

    self.query_update = function (test) {
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
        .done();
    };

    self.query_delete = function (test) {
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
        .done();
    };

    self.one = function (test) {
        test.expect(2);
        var self = this;
        self.sql.one('SELECT `id` FROM `table`')
        .then(function (res) {
            test.deepEqual(res, { id: 1 }, 'only returns one result');
            return self.sql.one('SELECT `id` FROM `table`', function (err, res) {
                test.deepEqual(res, { id: 1 }, 'takes callback');
                test.done();
            });
        })
        .done();
    };

    self.oneNestedJoin = function (test) {
        test.expect(1);
        this.sql.one({
            sql: 'SELECT * FROM `table` ' +
                 'INNER JOIN `table2` ' +
                 'ON `table`.`field` = `table2`.`field`',
            nestTables: true
        })
        .then(function (res) {
            test.deepEqual(res, {
                table: {
                    id: 2,
                    unique: 'b',
                    field: 'bar'
                },
                table2: {
                    id: 1,
                    field: 'bar'
                }
            });
            test.done();
        })
        .done();
    };

    self.select = function (test) {
        test.expect(2);
        var self = this;
        self.sql.select('table', { id: 3, field: 'foo' })
        .then(function (res) {
            test.deepEqual(
                res, [{ id: 3, unique: 'c', field: 'foo' }],
                'promise'
            );
            self.sql.select('table', { id: 3, field: 'foo' }, function (err, res) {
                test.deepEqual(
                    res, [{ id: 3, unique: 'c', field: 'foo' }],
                    'callback'
                );
                test.done();
            });
        })
        .done();
    };

    self.selectOne = function (test) {
        test.expect(2);
        var self = this;
        self.sql.selectOne('table', { field: 'foo' })
        .then(function (res) {
            test.deepEqual(
                res, { id: 1, unique: 'a', field: 'foo' },
                'promise'
            );
            self.sql.selectOne('table', { field: 'foo' }, function (err, res) {
                test.deepEqual(
                    res, { id: 1, unique: 'a', field: 'foo' },
                    'callback'
                );
                test.done();
            });
        })
        .done();
    };

    self.insert_one_row = function (test) {
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
        .done();
    };

    self.insert_multi_row = function (test) {
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
        .done();
    };

    self.update = function (test) {
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
        })
        .done();
    };

    self.delete = function (test) {
        test.expect(1);
        var self = this;
        self.sql.delete('table', { field: 'foo' })
        .then(function (res) {
            connection.query(
                'SELECT * FROM `table`',
                function (err, res) {
                    test.deepEqual(res, [
                        { id: 2, unique: 'b', field: 'bar' }
                    ], 'deleted from database');
                    test.done();
                }
            );
        })
        .done();
    };

    self.unique_constraint_error = function (test) {
        test.expect(3);
        var self = this;
        self.sql.insert('table', { unique: 'a'})
        .catch(function (err) {
            test.ok(err instanceof createNodeMySQL.Error);
            test.strictEqual(err.code, 'ER_DUP_ENTRY', 'error code');
            test.strictEqual(err.indexName, 'unique', 'index name');
            test.done();
        })
        .done();
    };

    self.transactionsCommit = function (test) {
        test.expect(1);
        var self = this;
        self.sql.beginTransaction()
        .then(function () {
            return self.sql.insert('table', { unique: 'foozy' });
        })
        .then(function () {
            return self.sql.commit();
        })
        .then(function () {
            return self.sql.selectOne('table', { unique: 'foozy' });
        })
        .then(function (res) {
            test.deepEqual(res, {
                id: 4, unique: 'foozy', field: ''
            });
            test.done();
        })
        .done();
    };

    self.transactionsRollback = function (test) {
        test.expect(1);
        var self = this;
        self.sql.beginTransaction()
        .then(function () {
            return self.sql.insert('table', { unique: 'foozy' });
        })
        .then(function () {
            return self.sql.rollback();
        })
        .then(function () {
            return self.sql.selectOne('table', { unique: 'foozy' });
        })
        .then(function (res) {
            test.strictEqual(res, undefined);
            test.done();
        })
        .done();
    };

    self.queryPaginate = function (test) {
        test.expect(1);
        var self = this;
        self.sql.query({
            sql: 'SELECT id FROM `table`',
            paginate: {
                page: 1,
                resultsPerPage: 2
            }
        })
        .then(function (results) {
            test.deepEqual(_.pluck(results, 'id'), [1, 2]);
            test.done();
        })
        .done();
    };

    self.paginateSelect = function (test) {
        test.expect(1);
        this.sql.select({
            table: 'table',
            paginate: {
                page: 1,
                resultsPerPage: 2
            }
        })
        .then(function (results) {
            test.deepEqual(_.pluck(results, 'id'), [1 , 2]);
            test.done();
        })
        .done();
    };

    self.fieldsSelect = function (test) {
        test.expect(1);
        this.sql.select({ table: 'table', fields: ['id'] })
        .then(function (results) {
            test.deepEqual(results, [{ id: 1 }, { id: 2 }, { id: 3 }]);
            test.done();
        })
        .done();
    };

    self.fieldsSelectOne = function (test) {
        test.expect(1);
        this.sql.selectOne({ table: 'table', fields: ['id'] })
        .then(function (result) {
            test.deepEqual(result, { id: 1 });
            test.done();
        })
        .done();
    };


    return self;
};
