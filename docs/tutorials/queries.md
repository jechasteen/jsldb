## Query Objects

```javascript
db.find([
    new Query('tablename', 'fieldname1', 'eq', 'John'),
    new Query('tablename' 'fieldname2', 'gt', 42)
], {
    caseSensitive: true
}, (err, entries) => {
    if (err)
})
```
Each Query object specifies the table to be searched, the field to be matched, the comparison function used match, and the value to compare against.

Note: you must instantiate a Query with `new`!

## Match Types

|Function|Description|
|----------|-----------|
|eq|equal to|
|gt|greater than|
|lt|less than|
|gte|greater than or equal to|
|lte|less than or equal to|
|regex|regular expression|
|contains|array contains|

## Query Methods

A query can be made with one rule or unlimited rules.

Which query function you call determines the logic performed on the rules.
Matching entries will be returned in the form of an object with each entry's id as the keys.
If there are no entries, null will be returned.
Never {} or undefined.

|name|logic|description|
|-|-|-|
|find|`AND`|Alias for `findAll`|
|findAll|`AND`|Returns all|
|findAny|`OR`|Returns all|
|findAnyN|`OR`|Returns the first N|
|findAnyOne|`OR`|Returns the first|
|findById|N/A|Exception to the query rule, see below|
|findN|`AND`|Returns the first N|
|find1|`AND`|Returns the first|

In the case of `findById`, instead of a query object you only need to pass a UUID that will match with a single entry.

## Options

In order to provide more flexibility, the `find()` method allows an options object to customize the search. This allows you to either hard code the query function, or to determine it at run time.

Note: some of these options are supported only for specified query functions. If an unsupported option is passed, the search will continue as if it had not been.

|name|type|default|description|
|-|-|-|-|
|caseSensitive|boolean|false|whether or not to match case|
|n|number|-1|for `findN` and `findAnyN` queries only, how many items to find. -1 returns all. 0 returns null.
|queryFunction|string|'all'|selects the query function to call. the string is the function name, dropping 'find', e.g. 'anyOne'


## Putting it all together

Let's say you have a table of employee info or something.
You want to find all employees with the name Jeff that don't have an email.

```javascript
db.findAll(
    new Query('employees', 'name', 'eq', 'Jeff'),
    (err, entries) => {
        if (err) console.log(err)
        res.render('page', { employeesNamedJeff: entries })
    }
)
```

or maybe you want any employees with '@gmail.com' or '@live.com' email adresses 

```javascript
db.findAny(
    new Query('employees', 'email', 'regex', RegExp(/.+@((gmail)|(live)).com/g)),
    (err, entries) => {
        if (err) console.log(err)
    }
    res.render('page', { emails: entries })
)
```