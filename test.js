const jsl = require('./');
const fs = require('fs');
const path = require('path');

// function p (...str){
//     var w = 0
//     str.forEach( s => { if (s) console.log(s); });
// }

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


console.log('\nDelete field (by id)');
(function() {
    for (var i in people) {
        jsl.delete('people', people[i]._id, printData);
    }
})();

console.log('\nGet tables');
tables = jsl.tables();
console.log(tables)

console.log('\nFind using field value: ');
jsl.find('people', { name: "James" }, printData);

