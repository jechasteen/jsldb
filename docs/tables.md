# Table Object Definition (Schema)

When creating a new databse, you must pass an object to the {@link create} function that defines the types that are to be expected for each entry.

```
const tables = {
    firstTable: {
        firstField: {
            type: 'type',
            required: true
        },
        secondField: {
            type: 'type',
        },
        ...
    },
    secondTable: {
        ...
    }
}
```

You can use this format to creat an arbitrary number of tables, each with an arbitrary number of fields.

Each field has 2 members: type and required.

The basic types are 'number', 'string', 'date' which are used to check values when inserting a new entry.

Each type can also be declared as an array as such: 'array *number*'

An entry’s id be can be use as a reference to an entry in a neighboring table. To do so, use the form 'id *tablename*'. You can also make an array of ids by using 'array id *tablename*'. Doing so will check that the referenced table actually exists.

Ironically, the parameter `required` is optional, it defaults to false if not included. If a field is marked `required: true` and no value is passed upon insertion, an error signal will be emitted and the entry will be rejected. 

Following is a sample tables object.

```
const tables = {
    people: {
        name: {
            type: 'string',
            required: true
    },
        height: {
            type: 'number'
        },
        birthdate: {
            type: 'date',
            required: true
        },
        favcolors: {
            type: 'array id colors'
        }
    },
    colors: {
        name: {
            type: 'string',
            required: true
        },
        hex: {
            type: 'string',
            required: true
        }
    }
}
```
