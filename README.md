#node-mysql-wrap

A lightweight wrapper for the [node-mysql](https://github.com/felixge/node-mysql)
driver.  Providing, select, insert, update, delete, row count, and support
for promises.

`npm install mysql-wrap`

##Instantiation
```javascript
//create a node-mysql connection
var mysql = require('mysql');
var connection =  mysql.createConnection({
    host: 'your-host-name',
    user: 'your-user',
    password: 'your-password',
    database: 'your-database-name'
});

//and pass it into the node-mysql-wrap constructor
var createMySQLWrap = require('mysql-wrap');
var sql = createMySQLWrap(connection);
```

##Methods

In general node-mysql-wrap exposes the same interface as node-mysql.  All methods
take callbacks with the same `function (err, res) {}` signature as node-mysql.
In addition all methods also return [q](https://github.com/kriskowal/q) promises.

In node-mysql SELECT statements return an array of results.  node-mysql-wrap SELECT
return statements return an object where the results array is on a field named
`results`.  node-mysql SELECT statement objects also have a count method that takes
either a callback or returns a promise.  Count queries the database for the number
of rows the associated SELECT statement would have returned without a LIMIT clause
(if it has one).  This is useful for doing pagination.

In the following examples, parameters marked with an asterik (*) character are
optional.

###query(sqlStatement, *values, *callback)
```javascript
sql.query('SELECT name FROM fruit WHERE color = "yellow" LIMIT 2')
.then(function (res) {
    console.log(res.results);
    //example output: [{ name: "banana" }, { name: "lemon" }]
    return res.count();
})
.then(function (numberOfYellowFruit) {
    //count returns the number of all fruit that are yellow (exludes the LIMIT clause)
});
```

###one(sqlStatement, *values, *callback)
Works the same as sql.query except it only returns a single row instead of an array
of rows.  Adds a "LIMIT 1" clause if a LIMIT clause is not allready present in
the sqlStatement.

###select(table, *whereEqualsObject, *callback)
```javascript
// equivalent to sql.query('SELECT * FROM fruit WHERE color = "yellow" AND isRipe = "true"')
sql.select('fruit', { color: 'yellow', isRipe: true })
```

###selectOne(table, *whereEqualsObject, *callback)
Same as sql.select except selectOne returns a single row instead of an array of rows.

###insert(table, insertObject, *callback)
```javascript
sql.insert('fruit', { name: 'plum', color: 'purple' });
```
You can also pass sql.insert an array of insertObjects to insert multiple rows in a query
```javascript
sql.insert('fruit', [
    { name: 'plum', color: 'purple'},
    { name: 'grape', color: 'green' }
])
```

###update(table, setValues, *whereEqualsObject, *callback)
```javascript
sql.update('fruit', { isRipe: false }, { name: 'grape' })
```

###delete(table, *whereEqualsObject, *callback)
```javascript
sql.delete('fruit', { isRipe: false })
```

##Errors
Errors are the first parameter of a methods callback (same as in node-mysql), or
using promises they are passed to the catch method
```javascript
sql.insert('fruit', { name: 'banana' })
.catch(function (err) {

});
```
