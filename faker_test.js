/*!
 * Tests the db by giving it A LOT of random information.
 */

const f = require('faker');

const r = (min, max) => Math.floor(Math.random() * max) + min;

const create = {};

create.employee = () => {
    return {
        name: f.name.findName(),
        email: f.internet.email(),
        phone: f.phone.phoneNumber(),
        birthdate: f.date.past(21),
        address: f.address.streetAddress(true),
        workload: []
    }
}

create.client = () => {
    return {
        name: f.company.companyName(),
        email: f.internet.email(),
        address: f.address.streetAddress(true),
        contact_name: f.name.findName()
    }
}

create.ticket = () => {
    const bodySize = r(1, 12);
    const numNotes = r(0, 4);

    return {
        title: f.lorem.sentence(),
        body: f.lorem.sentences(bodySize),
        posted: new Date(),
        due: f.date.future(1),
        notes: ((n) => {
            let noteArray = [];
            while (n) {
                noteArray.push(f.lorem.sentence());
                n--;
            }
            return noteArray;
        })(numNotes),
        assigned: []
    }
}

// 
// Now set up JSLDB

const usage =
`JSLDB Faker Test
usage: node faker_test.js runtype
Run types:
    --create [dbname]
    --connect [dbname]`;

let dbname, runtype;

if (!process.argv[2]) {
    console.log(usage);
    process.exit();
} else if (process.argv[2] === '--create' && process.argv[3]) {
    dbname = process.argv[3];
    runtype = 'create';    
} else if (process.argv[2] === '--connect' && process.argv[3]) {
    dbname = process.argv[3];
    runtype = 'connect';
} else {
    console.log(usage);
    process.exit();
}

const db = require('./');

const testTables = {
    employees: {
        name: {
            type: 'string',
            required: true
        },
        email: {
            type: 'string'
        },
        phone: {
            type: 'string'
        },
        birthdate: {
            type: 'date',
            required: true
        },
        address: {
            type: 'string'
        },
        workload: {
            type: 'array id tickets'
        }
    },
    clients: {
        name: {
            type: 'string',
            required: true
        },
        email: {
            type: 'string',
            required: true
        },
        address: {
            type: 'string',
            required: true
        },
        contact_name: {
            type: 'string'
        }
    },
    tickets: {
        title: {
            type: 'string',
            required: true
        },
        body: {
            type: 'string',
            required: true
        },
        posted: {
            type: 'date',
            required: true
        },
        due: {
            type: 'date',
            required: true
        },
        notes: {
            type: 'array string'
        },
        assigned: {
            type: 'array id employees'
        }
    }
}

if (runtype === 'create') {
    db.create(dbname, testTables, false);

    const q = {
        e: 1000,
        c: 96,
        t: 8900
    };

    // DO THE STUFF (HOLY CRAP IT'S A LOT! almost 7M)
    (() => {
        console.log(`Creating ${q.e + q.c + q.t} entries`);
        // create the employees
        console.log('Creating Employees');
        for (let i = 0; i < q.e; i++) {
            db.insert('employees', create.employee());
        }
        // create the clients
        console.log('Creating Clients');
        for (let i = 0; i < q.c; i++) {
            db.insert('clients', create.client());
        }
        // create the tickets
        console.log('Creating tickets');
        for (let i = 0; i < q.t; i++) {
            if (!db.insert('tickets', create.ticket())) {
                i--;
            }
            
        }
        
        console.log(db.findById('tickets', 8899));

        // employees.workload -> ticket._id :: tickets.assigned -> employee._id
        let remainingTickets = q.t - 1;
        console.log('Assigning tickets');
        while (remainingTickets >= 0) {
            const employeesAssigned = ((n) => {
                let assigned = [];
                for (let i = 0; i < n; i++) {
                    let randEmployee = r(0, q.e);
                    if (assigned.indexOf(randEmployee) < 0) {
                        assigned.push(randEmployee);
                    }
                }
                return assigned;
            })(r(1, 2));

            db.setFieldById('tickets', remainingTickets, 'assigned', employeesAssigned);

            employeesAssigned.forEach( id => {
                let currentWorkload = db.findById('employees', id).workload;
                currentWorkload.push(remainingTickets);
                db.setFieldById('employees', id, 'workload', currentWorkload);
            });

            remainingTickets--;
        }
    })()

    db.save();

}
//require('fs').writeFileSync('faked.json', jsonDB, 'utf-8');

if (runtype === 'connect') {
    db.connect(dbname);
    console.log(`Connected to ${dbname}`);

    db.find('employees', { name: 'Jana Dare' }, (res, data) => {
        data[0].workload.forEach( t => {
            console.log(db.findById('tickets', t));
        });
    });
}