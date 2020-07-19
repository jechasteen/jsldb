const jsl = require('./');
const fs = require('fs');
const path = require('path');

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

const printData = (res, data) => {
    if (res) {
        console.log('Action successful\n', data);
    } else {
        console.log('Failed: ', data);
    }
}

console.log('Creating new database');
if (jsl.create('db', testTables)) {
    console.log('New DB successfully created');
} else {
    console.log('New DB failed');
}

console.log('\nInsert entry into "people"');
try {
    jsl.insert('people', {
        name: 'Jonathan',
        age: 32,
        hometown: 'Dayton',
        birthdate: new Date('July 29 1986'),
    }, printData);
} catch (e) {
    console.log(e);
}

console.log('\nInsert entry into "people"');
try {
    jsl.insert('people', {
        name: 'James',
        age: 30,
        hometown: 'Xenia',
        birthdate: new Date('March 3 1989'),
    }, printData);
} catch (e) {
    console.log(e);
}

console.log('\nGet tables');
let tables = jsl.tables();
console.log(tables)

console.log('\nSet field by id: "people" change hometown to Trotwood');
let people = tables["people"];

(function() {
    for (var i in people) {
        console.log(`set ${people[i]._id}`);
        jsl.setFieldById('people', people[i]._id, 'hometown', 'Trotwood', printData);
    }
})();

console.log('\nGet entry by id:');
(function() {
    for (var i in people) {
        jsl.findById('people', people[i]._id, printData);
    }
})();

console.log('\nSave db: ');
jsl.saveSync();

console.log('\nOpen database file: ');
let jsl2 = require('./');
jsl2.connect('db');
people = jsl2.tables().people;

console.log('\nDelete field (by id)');
(function() {
    for (var i in people) {
        console.log(`Delete ${people[i].name}.`);
        jsl2.delete('people', people[i]._id, printData);
    }
})();

console.log('\nGet tables');
tables = jsl2.tables();
console.log(tables);

console.log('\nFind using field value (should return undefined): ');
jsl2.find('people', { name: "James" }, printData);

console.log('\nRemoving temporary db.db.json file.');
fs.unlink(jsl.path(), (err) => {
    if (err) console.log(`\nError removing ${jsl.path()}: ${err}`);
    else console.log(`\nSucessfully removed ${jsl.path()}`);
});

