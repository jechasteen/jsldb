const jsl = require('./');
const fs = require('fs');
const path = require('path');

function p (...str){
    str.forEach( s => {
        console.log(s);
    });
}

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
        },
        siblings: {
            type: 'array id people'
        },
        favColors: {
            type: 'array id colors'
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
        p('Action successful\n', data);
    } else {
        p('Failed: ', data);
    }
}

p('Creating new database');
if (jsl.create('db', testTables)) {
    p('New DB successfully created');
} else {
    p('New DB failed');
}

p('\nInsert entry into "people"');
jsl.insert('people', {
    name: 'Jonathan',
    age: 32,
    hometown: 'Dayton',
    birthdate: new Date('July 29 1986'),
    siblings: [1],
    favColors: []
}, printData);

p('\nInsert entry into "people"');
jsl.insert('people', {
    name: 'James',
    age: 30,
    hometown: 'Xenia',
    birthdate: new Date('March 3 1989'),
    siblings: [0],
    favColors: []
}, printData);

p('\nGet the entire database object');
jsl.getAll(printData);

p('\nSet field by id: "people" change hometown to Trotwood');
jsl.setFieldById('people', 1, 'hometown', 'Trotwood', printData);

p('\nGet field by id: 0');
jsl.getById('people', 0, printData);

p('\nDelete field (by id)');
jsl.delete('people', 0, printData);

p('\nFind using tableName: "valueToMatch"');
jsl.find('people', { name: "James" }, printData);