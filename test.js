const jsldb = require('./')
const fs = require('fs')

// TODO: We really need to make sure that it's clear what's passing and what's failing
//       There should not only be markings (color?) but also a total at the end of the tests

const testTables = {
    people: {
        name: {
            type: 'string',
            required: true
        },
        age: {
            type: 'number',
            required: true
        },
        hometown: {
            type: 'string'
        },
        birthdate: {
            type: 'date',
            required: true
        }
    },
    colors: {
        name: {
            type: 'string',
            required: true
        },
        value: {
            type: 'string',
            required: true
        }
    }
}

const printData = (err, data) => {
    if (err) {
        console.log('Failed: ', data)
    } else {
        console.log('Action successful\n', data)
    }
}

console.log('Creating new database')
const db = jsldb.relational('db', testTables)
if (db) {
    console.log('New DB successfully created')
} else {
    console.log('New DB failed')
}

console.log('\nInsert entry into "people"')
try {
    db.insert('people', {
        name: 'Jonathan',
        age: 32,
        hometown: 'Dayton',
        birthdate: new Date('July 29 1986')
    }, printData)
} catch (e) {
    console.log(e)
}

console.log('\nInsert entry into "people"')
try {
    db.insert('people', {
        name: 'James',
        age: 30,
        hometown: 'Xenia',
        birthdate: new Date('March 3 1989')
    }, printData)
} catch (e) {
    console.log(e)
}

console.log('\nGet tables')
let tables = db.tables()
console.log(tables)

console.log('\nSet field by id: "people" change hometown to Trotwood')
let people = tables.people;

(function () {
    for (var i in people) {
        console.log(`set ${people[i]._id}`)
        db.setFieldById('people', people[i]._id, 'hometown', 'Trotwood', printData)
    }
})()

console.log('\nGet entry by id:');
(function () {
    for (var i in people) {
        db.findById('people', people[i]._id, printData)
    }
})()

console.log('\nSave db: ')
db.saveSync()

console.log('\nOpen database file: ')
const db2 = jsldb.relational('db', testTables)
people = db2.tables().people

console.log('\nDelete field (by id)');
(function () {
    for (var i in people) {
        db2.deleteById('people', people[i]._id, printData)
    }
})()

console.log('\nGet tables')
tables = db2.tables()
console.log(tables)

console.log('\nFind using field value (should return undefined): ')
db2.find('people', { name: 'James' }, printData)

console.log('\nRemoving temporary db.db.json file.')
fs.unlink(db.path(), (err) => {
    if (err) console.log(`\nError removing ${db.path()}: ${err}`)
    else console.log(`\nSucessfully removed ${db.path()}`)
})
