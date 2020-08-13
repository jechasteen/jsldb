# jsldb.relational

## Construction

### `const jsldb = require('jsldb')`

### `jsldb.relational(dbName, tableSchemas)`

|param|type|desc|
|-----|----|----|
|dbName|string|The only real significance of this string is the file that will be created upon calling `save()` or `saveSync()`. The file will be saved as `dbName.db.json` in the current directory|
|tableSchemas|Schema|The [Schema](../Schemas.md) for the new database. This object determines the field and type data for the resulting db.

## Adding Entries

### `db.insert(table, entry, callback)`

|param|type|desc|
|-----|----|----|
|table|string|The name of the table the new entry will be inserted into. This is the same as its key in the Schema in quotes.|
|entry|object|The entry (conforming to the table's schema) that will be inserted. It will be assigned an `_id` automatically.|
|callback|function|[(Error, entry)](#Callbacks) The `entry` parameter will, on success, be the entry passed to the `insert` function with its newly-minted `_id` field.|

## Callbacks

Most of the callbacks have two parameters

1. Instance of `Error` if there was one, otherwise `null`
2. The entry or entries in question. This is dependent upon the context, see the function in question for more info.

```js
db.insert('table', entry, (err, entry) => {
    db.find(
        new Query('table', 'name', 'eq', 'Francis'),
        { queryType: }
    )
})
```