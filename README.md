# JavaScript Local Database

JSLDB saves as a JSON file, but responds with easy to use JS objects from memory.

*NOTE: This project is currently a work in progress and, as such, will be under heavy development. Use at your own risk before version 0.1.0*

## Getting Started

see the [Documentation](https://jechasteen.github.io/jsldb)

### Schema / Table Definition

Tables are defined in a manner similar to mongoose, where an object defines the types of each field.

To generate and view documentation locally, clone the repo and then call `jsdoc index.js -c .jsdoc.json && firefox doc/index.html`

### Example

```javascript
const express = require('express');
const app = express();
const jsl = require('jsldb');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

// One or the other depending on circumstance {

jsl.create('newdb', tables, true)

// OR

jsl.connect('newdb');

// }

app.get('/table1/:id', (req, res) => {
    jsl.getById('table1', req.params.id, (success, data) => {
        if (success) {
            res.render('table1', data);
        } else {
            res.redirect('/');
        }
    });
});

app.post('/table1', (req, res) => {
    // Pass data from the browser to the server wrapped inside an object named entry attached to the request body
    jsl.insert('table1', req.body.entry, (success, data) => {
        if (success) {
            res.redirect('/table1');
        } else {
            res.redirect('/');
        }
    });
});

app.delete('/table1/:id', (req, res) => {
    jsl.delete('table1', req.params.id, (success, data) => {
        if (success) {
            res.redirect('/');
        } else {
            res.render('error');
        }
    })
});

app.listen(8080, '127.0.0.1');
```
