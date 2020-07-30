## Query Objects

```javascript
db.find('tableName', {
    fieldName1: {
        // This is the Query Object, it contains RULES
        eq: 'John', // This is a rule
    },
    fieldName2: {
        gt: 42      // This is a rule too
    }
}, {
    caseSensitive: true // This is the options object
}, (err, entries) => {
    if (err)
})
```
Each rule consists of a pair: the field name, and an object containing 1 (and only 1) match function.

|Match Function|Description|
|----------|-----------|
|eq|equal to|
|gt|greater than|
|lt|less than|
|gte|greater than or equal to|
|lte|less than or equal to|
|regex|regular expression|
|contains|array contains|

## Query Functions

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
|findOne|`AND`|Returns the first|

In the case of `findById`, instead of a query object you only need to pass a UUID that will match with a single entry.

## Options

The last two 

|name|type|default|description|
|-|-|-|-|
|caseSensitive|boolean|false|whether or not to match case|
|n|number|-1|for `findN` and `findAnyN` queries only, how many items to find. -1 returns all. 0 returns null.


## Putting it all together

Let's say you have a table of employee info or something.
You want to find all employees with the name Jeff that don't have an email.

```javascript
db.find('employees', {
    name: {
        eq: 'Jeff'
    },
    email: {
        eq: undefined
    }
})
```

or maybe you want any employees with '@gmail.com' or '@live.com' email adresses 

```javascript
db.findAny('employees', {
    email: {
        regex: /.+@((gmail)|(live)).com/g
    }
})
```