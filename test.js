const jsl = require('./');
const fs = require('fs');
const path = require('path');

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
        console.log(data);
    } else {
        console.error('Failed: ', data);
    }
}

jsl.create('db', testTables);

jsl.insert('people', {
    name: 'Jonathan',
    age: 32,
    hometown: 'Dayton',
    birthdate: new Date('July 29 1986'),
    siblings: [],
    favColors: []
}, printData);

jsl.insert('people', {
    name: 'James',
    age: 30,
    hometown: 'Xenia',
    birthdate: new Date('March 3 1989'),
    siblings: [0],
    favColors: []
}, printData);

jsl.setFieldById('people', 1, 'hometown', 'Dayton', printData);

jsl.getById('people', 0, printData);

jsl.delete('people', 0, printData);