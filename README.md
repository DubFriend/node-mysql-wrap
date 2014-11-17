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

You can also enable connection pooling by passing a connection pool rather than
a connection
```javascript
//create a node-mysql pool
var mysql = require('mysql');
var pool =  mysql.createPool({
    host: 'your-host-name',
    user: 'your-user',
    password: 'your-password',
    database: 'your-database-name'
});
//and pass it into the node-mysql-wrap constructor
var createMySQLWrap = require('mysql-wrap');
var sql = createMySQLWrap(pool);
```

##Methods

In general node-mysql-wrap exposes the same interface as node-mysql.  All methods
take callbacks with the same `function (err, res) {}` signature as node-mysql.
In addition all methods also return [q](https://github.com/kriskowal/q) promises.

In the following examples, parameters marked with an asterik (*) character are
optional.

###query(sqlStatement, \*values, \*callback)
```javascript
sql.query('SELECT name FROM fruit WHERE color = "yellow"')
.then(function (res) {
    console.log(res);
    //example output: [{ name: "banana" }, { name: "lemon" }]
});
```

`query` may take a configuration object in place of the `sqlStatement` parameter.
this object allows for node-mysql's nested table join api, as well as pagination.
```javascript
sql.query({
	sql: 'SELECT * FROM fruitBasket LEFT JOIN fruit ON fruit.basketID = fruitBasket.id',
	nestTables: true,
	paginate: {
		page: 3,
		resultsPerPage: 15
	}
});
```

###one(sqlStatement, \*values, \*callback)
Works the same as sql.query except it only returns a single row instead of an array
of rows.  Adds a "LIMIT 1" clause if a LIMIT clause is not allready present in
the sqlStatement.

###select(table, \*whereEqualsObject, \*callback)
```javascript
// equivalent to sql.query('SELECT * FROM fruit WHERE color = "yellow" AND isRipe = "true"')
sql.select('fruit', { color: 'yellow', isRipe: true })
```

###selectOne(table, \*whereEqualsObject, \*callback)
Same as sql.select except selectOne returns a single row instead of an array of rows.


`select` and `selectOne` may take a configuration object in place of the table
parameter.  The configuration object add pagination and/or restrict which fields
are selected.
```javascript
sql.select({
	table: 'fruit',
	fields: ['color'],
	paginate: {
		page: 2,
		resultsPerPage: 15
	}
});
```



###insert(table, insertObject, \*callback)
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

###update(table, setValues, \*whereEqualsObject, \*callback)
```javascript
sql.update('fruit', { isRipe: false }, { name: 'grape' })
```

###delete(table, \*whereEqualsObject, \*callback)
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

Error objects are wrapped in a custom Error object.  A reference to this object
can be gotten at `sql.Error`

##Transactions
The node-mysql transaction methods `beginTransaction`, `commit`, and `rollback`
are available, and return promises as well as take callbacks.
```javascript
sql.beginTransaction()
.then(function () {
	return sql.insert(...)

})
.then(function () {
	sql.commit();
})
.catch(function (err) {
	return sql.rollback(function (err) {
		throw err;
	});
});
```

##Other methods.

###end, destroy, release, changeUser
same as in node-mysql.  `end` and `changeUser` return a promise as well as taking
a callback.
