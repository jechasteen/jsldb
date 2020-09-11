# jsldb.relational

[Glossary](../Glossary.md) of terms used in this document

## Construction

### `const jsldb = require('jsldb')`

### `jsldb.relational(dbName, tableSchemas)`

|param|type|desc|
|-----|----|----|
|dbName|string|The significance of this string is the db file name upon calling `save()` or `saveSync()`. The file will be saved as `dbName.db.json` in the current directory|
|tableSchemas|[Schema](../Schemas.md)|This object configures the field and type data.

## Adding Entries

### `db.insert(table, entry, callback)`

|param|type|desc|
|-----|----|----|
|table|string|The name of the table the new entry will be inserted into. This is the same as its key in the Schema in quotes.|
|entry|object|The entry (conforming to the table's schema) that will be inserted. It will be assigned an `_id` automatically.|
|callback|function|[(Error, entry)](#Callbacks) The `entry` parameter will, on success, be the entry passed to the `insert` function with its newly-minted `_id` field.|

```js
db.insert('table', entry, (err, entry) => {
    if (err) res.redirect('/failure')
    if (entry) res.redirect('/success')
})
```

## Deleting Entries

### `db.deleteById(table, id, callback)`

|param|type|desc|
|-----|----|----|
|table|string|The table to select|
|id|UUID string|The id of the item to delete|
|callback|function|[(Error)](#Callbacks)

```js
db.deleteById('table', entry._id, handleDelete)
```

## Updating Entries

### `db.updateById(table, id, callback)`

|param|type|desc|
|-----|----|----|
|table|string|The table to select|
|id|UUID string|The id of the item to delete|
|callback|function|[(Error, entry)](#Callbacks) **REQUIRED**

Make the changes to the entry inside of the callback

```js
db.updateById('table', uuid, (err, entry) => {
    if (err) res.redirect('/failure')
    entry.name = 'new name'
    entry.save()
    res.redirect('/success')
})
```

```js
const updateEntry = (err, entry) => {
    if (err) res.redirect('/failure')
    entry.name = 'new name'
    entry.save()
    res.redirect('/success')
}

db.updateById('table', entry._id, updateEntry)
```

be sure to call `.save()` on the entry, otherwise nothing will happen.

## Saving

### `db.saveSync()` -> Boolean

Returns true if writing the file succeeds.

```js
if (db.saveSync()) res.redirect('/success')
else res.redirect('/failure')
```

### `db.save(callback)`

#### Callback `(Error) => { ... }`

```js
db.save((err) => {
    if (err) res.redirect('/failure', { error: err })
    else res.redirect('/success')
})
```

Handle `fs.write` error inside the callback.

## Queries

The search process consists of `Query` passed to a `find` function.
Before submitting a query, consider the conditions and then insert those parameters into a new query.

### `new Query(table, field, logic, value)`

|param|type|desc|
|-----|----|----|
|table|string|The table to select|
|field|string|The field to check|
|logic|string|A [Query Logic](#Query\ Logic) string|

### Query Logic

When constructing a a query, you may choose from the following logic:

|string|desc|
|------|----|
|`'eq'`|strict equal to|
|`'gt'`|greater than (literally `value > entry ?`)|
|`'lt'`|less than|
|`'gte'`|greater than or equal to|
|`'lte'`|less than or equal to|
|`'regex'`|`new RegExp('/something/g')`|
|`'contains'`|for array fields only, does the array contain?|

For each of the boolean comparisons above, it is literally `value > entry ? ...`

```js
const q = new Query('table', 'field', 'lte', 64)
```

See [Queries](../Queries.md) for more detail.

## Find Functions

### `find(query, options, callback) -> entries: object`

|param|members|type|default|desc|
|----|----|----|----|----|
|query||`Query or Query[]`|||
|options||`'object'`|||
||`.queryLogic`|`'string'`|ALL|The type of logic used when combining multiple queries. Accepted values are `'AND'` and `'OR'`
||`.n`|`'number'`|Infinity|The number of matching entries to return|
|callback||`'function'`||[(err, entries)](#Callbacks)

This is the main find function.
All others are simply mapped to this functions for convenience.
You may omit the options object and pass `(query, callback)` as the parameters.
You will get the defaults in the table above.

#### Entries will be null, or 1+ entries as an object with `._id` as keys.

```js
db.find([
    new Query('table1', 'size', 'gt', 5),
    new Query('table1', 'size')
], (err, entries) => {
    if (err) res.redirect('/failure')
    if (entries) res.redirect('/success', { entries: entries })
})
```

### Basic find functions

All of these functions have the parameters `(query, callback)` where query is `Query` or `Query[]`, and the callback gets `(err, entries)`.

#### `(query, callback)`

|function|logic|
|----|----|
|`findAll`|AND Logic|
|`findAny`|OR Logic|
|`findAny1`|OR Logic|
|`find1`|AND Logic|

```js
findAny(new Query('table', 'age', 'lt', 50),
    (err, entries) => {
        if (err) res.redirect('/failure')
        if (entries) res.redirect('/success')
    }
)
```

### Find N functions

Find n functions work the same as other find functions, but require an additional parameter.

#### `(n, query, callback)`

|function|logic|
|----|----|
|`findN`|AND|
|`findAnyN`|OR|

```js
db.findN(5, new Query('table', 'length', 'gt', 100),
    (err, entries) => {
        ...
    }
)
```

## Callbacks

Most of the callbacks have two parameters

1. Instance of `Error` if there was one, otherwise `null`
2. The entry or entries in question. This is dependent upon the context, see the function in question for more info.

All callback parameters are optional.
In some instances, though, the *method* requires a callback.

Consider:
```js
const foundEntry = db.findOne(new Query('table', 'field', 'eq', val))
if (foundEntry) {
    res.render('somePage', { entry: foundEntry })
}
```
vs
```js
db.findOne(
    new Query('table', 'field', 'eq', val),
    (err, entry) => {
        if (err) res.redirect('/failure')
        if (entry) res.render('somePage', { entry: entry })
    }
)
```

and

```js
const newEntry = db.insert('table', entry)
const query = new Query('table', 'group', 'eq', 'name-of-group')
// This is how updating works. You have to get to the _id (the UUID)
const otherEntriesl = db.find(query)
db.updateByIds('table', otherEntry._id, (err, entry) => {
    if (err) res.redirect('/failure')
    entry.fellowMembers.push(newEntry._id)
    res.redirect('/success')
})
```

vs

```js
db.insert('table', entry, (err, newEntry) => {
    db.find(
        new Query('table', 'group', 'eq', 'name-of-group'),
        { queryType: 'AND' },
        (err, entries) => {
            if (err) {
                res.redirect('/failure')
            }
            for (var id in entries) {
                entries[id]['fellowMembers'].push(newEntry._id)
            }
            res.redirect('/success')
        }
    )
})
```

Sometimes a callback is convenient. Other times, like the last example above, it can get really deep, really fast. Callback hell.

Any time this happens, refactor your code. Remember, for virtually all functions (except `updateById`) the callback parameter is optional. It is for convenience. The function also returns the entry or an error.

## Advanced

### Raw data

There are getters for a few raw data members:

#### `db.tables()` -> the complete raw tables object

#### `db.schema()` -> the verified schema object

#### `db.path()` -> path to the .db.json file