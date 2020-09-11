# JavaScript Light Database

[![Build Status](https://travis-ci.org/jechasteen/jsldb.svg?branch=master)](https://travis-ci.org/jechasteen/jsldb) [![codecov](https://codecov.io/gh/jechasteen/jsldb/branch/master/graph/badge.svg)](https://codecov.io/gh/jechasteen/jsldb) [![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/jechasteen/jsldb.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/jechasteen/jsldb/context:javascript)

In-memory database for Node with no dependencies.
jsldb is statically typed, fast, and easy to use.

jsldb is intended for rapid prototyping and other non-critical use-cases.
Get functionality similar to mongoose without needing to spin up an instance.

## Getting Started

Have a look at the [docs](https://jechasteen.github.io/jsldb) for in-depth information about methods and a few tutorials.

### Basic principles

See [glossary](https://jechasteen.github.io/jsldb/tutorial-glossary.html)

jsldb offers a relational database that can contain any number of `tables`.
A table is a named object that contains any number of `entries`, each of which is referenced by a UUID.
Each of these entries must conform to a rigid [schema](https://jechasteen.github.io/jsldb/tutorial-schemas.html) that ensures that the types conform.

Upon insertion of a new entry, the entry is compared against the schema for type, and optionally to ensure that the `field` has a defined value.
Accessing an entry directly via its id is a quick operation thanks to V8 optimizations (see [this V8 devblog](https://v8.dev/blog/fast-properties) for more info).

A table can also be searched using one of several query functions.
Each of these query functions take a [query object](https://jechasteen.github.io/jsldb/tutorial-queries.html) that defines rules for matching entries.
Queries return an object containing the entry or entries which match the given query object, with each entry's id as its key.

### Example

```javascript
const express = require('express')
const app = express()
const { jsldb, Query } = require('jsldb')
const bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const tables = {
    table1: {
        field1: {
            type: 'string',
            required: true
        },
        field2: {
            type: 'array number',
            required: true
        },
        field3: {
            type: 'array id table2'
        }
    },
    table2: {
        field1: {
            type: 'date',
            required: true
        },
        field2: {
            type: 'id table1'
        }
    }
}

const db = jsldb('newdb', tables)

app.get('/table1/:id', (req, res) => {
    db.findById('table1', req.params.id, (err, data) => {
        if (err) res.render('error', { error: err })
        else res.render('table1', data)
    })
})

app.get('/table/q/:query', (req, res) => {
    db.findAll(
        new Query('table1', 'field1', 'eq', 'some string'),
        (err, entries) => {
            if (err) res.render('error', { error: err })
            else res.render('query', { results: entries })
        }
    )
})

app.post('/table1', (req, res) => {
    // Pass data from the browser to the server wrapped inside an object named entry attached to the request body
    db.insert('table1', req.body.entry, (err, data) => {
        if (err) res.render('error', { error: err })
        else res.redirect('/table1')
    })
})

app.delete('/table1/:id', (req, res) => {
    db.deleteById('table1', req.params.id, (err, data) => {
        if (err) res.render('error', { error: err })
        else res.redirect('/')
    })
})

app.listen(8080, '127.0.0.1')
```
