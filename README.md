# JavaScript Local Database

[![Build Status](https://travis-ci.org/jechasteen/jsldb.svg?branch=master)](https://travis-ci.org/jechasteen/jsldb) [![codecov](https://codecov.io/gh/jechasteen/jsldb/branch/master/graph/badge.svg)](https://codecov.io/gh/jechasteen/jsldb)

JSLDB saves as a JSON file, but responds with easy to use JS objects from memory.

*NOTE: This project is currently a work in progress and, as such, will be under heavy development. Use at your own risk before version 0.1.0*

## Getting Started

To generate and view documentation locally, clone the repo and then call `jsdoc -c .jsdoc.json && firefox docs/index.html`

### Example

```javascript
const express = require('express')
const app = express()
const jsldb = require('jsldb')
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
            type: 'id field1'
        }
    }
}

const db = jsldb.relational('newdb', tables, { autosave: true })

app.get('/table1/:id', (req, res) => {
    db.getById('table1', req.params.id, (err, data) => {
        if (err) {
            res.render('error', { error: err })
        } else {
            res.render('table1', data)
        }
    })
})

app.post('/table1', (req, res) => {
    // Pass data from the browser to the server wrapped inside an object named entry attached to the request body
    db.insert('table1', req.body.entry, (err, data) => {
        if (err) {
            res.render('error', { error: err })
        } else {
            res.redirect('/table1')
        }
    })
})

app.delete('/table1/:id', (req, res) => {
    db.deleteById('table1', req.params.id, (err, data) => {
        if (err) {
            res.render('error', { error: err })
        } else {
            res.redirect('/')
        }
    })
})

app.listen(8080, '127.0.0.1')
```
