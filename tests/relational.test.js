const fs = require('fs')
const jsldb = require('../')
const path = require('path')
const faker = require('faker')

const tPath = path.join(__dirname, '/test.db.json')

const passingSchema = {
    table1: {
        number: {
            type: 'number',
            required: true
        },
        string: {
            type: 'string',
            required: true
        },
        date: {
            type: 'date',
            required: true
        },
        idLink: {
            type: 'id table2',
        }
    },
    table2: {
        numberArray: {
            type: 'array number',
            required: true
        },
        stringArray: {
            type: 'array string',
            required: true
        },
        dateArray: {
            type: 'array date',
            required: true
        },
        idLinkArray: {
            type: 'array id table1',
            required: true
        }
    }
}

const failingSchemas = {
    badType: {
        table: { field: { type: undefined } }
    },
    unsupportedType: {
        table: { field: { type: 'float' } }
    },
    badTableLink: {
        table: { field: { type: 'id table2' } }
    },
    badArrayType: {
        table: { field: { type: 'array float' } }
    },
    badTableLinkArray: {
        table: { field: { type: 'array id table2' } }
    }
}

let db = undefined

describe('Creation, saving, and connection', () => {
    test('Create new database', () => {
        db = jsldb.relational('test', passingSchema, { autosave: true })
        expect(db).toBeTruthy()
    })
    
    test('Creation errors', () => {
        for (bad in failingSchemas) {
            try {
                jsldb.relational('bad', failingSchemas[bad])
            } catch (e) {
                expect(e).toBeDefined
            }
        }
    })
    
    test('Save (sync)', () => {
        expect(db.saveSync()).toBe(true)
    })
    
    test('Connect to existing database', () => {
        db = jsldb.relational('test', passingSchema)
        expect(db).toBeTruthy()
    })
})

let t1EntryId = undefined
let t2EntryId = undefined
let t1Entry = {
    number: 42,
    string: 'hello',
    date: new Date(),
}
let t2Entry = {
    numberArray: [1, 2],
    stringArray: ['hello', 'world'],
    dateArray: [new Date(), new Date()],
}

describe('Entry insertion and modification', () => {    
    test('Insert a table1 entry', (done) => {
        const brokenEntry = {
            number: 'string',
            string: 42,
            date: 5
        }
        db.insert('table1', brokenEntry, (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toBeNull()
            done()
        })
        db.insert('table1', t1Entry, (err, entry) => {
            if (err) done(err)
            t1EntryId = entry._id
            t1Entry._id = entry._id
            expect(entry).toBe(t1Entry)
            done()
        })
    })
    
    test('Insert a table2 entry', (done) => {
        db.insert('table2', t2Entry, (err, entry) => {
            if (err) done(err)
            t2EntryId = entry._id
            t2Entry._id = entry._id
            expect(entry).toBe(t2Entry)
            done()
        })
    })
    
    test('Both tables should have size 1', () => {
        expect(Object.size(db.getAllEntries('table1'))).toEqual(1)
        expect(Object.size(db.getAllEntries('table2'))).toEqual(1)
    })
    
    // Tie the two together
    test('setFieldById', (done) => {
        db.setFieldById('table1', t1EntryId, 'idLink', t2EntryId, (err, entry) => {
            if (err) done(err)
            if (!entry) done('Entry came back undefined');
            expect(entry.idLink).toEqual(t2EntryId)
            done()
        })
        db.setFieldById('table2', t2EntryId, 'idLinkArray', [t1EntryId], (err, entry) => {
            if (err) done(err)
            expect(entry.idLinkArray).toEqual([t1EntryId])
            done()
        })
        // non-existent id
        db.setFieldById('table1', 0, 'number', 12, (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toBeNull()
        })
        // make sure value matches field type
        db.setFieldById('table1', t1EntryId, 'number', 'string', (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toBeNull()
        })
    })
    
    test('Save (async)', (done) => {
        db.save( (err) => {
            if (err) done(err)
            expect(fs.existsSync(tPath)).toBe(true)
            done()
        })
    })    
})

describe('Get raw members', () => {
    test('Get all tables', () => {
        expect(db.tables()).toHaveProperty('table1')
        expect(db.tables()['table1'][t1EntryId]).toEqual(t1Entry)
        expect(db.tables()).toHaveProperty('table2')
        expect(db.tables()['table2'][t2EntryId]).toEqual(t2Entry)
    });
    
    test('Get all entries in table1 and table2', () => {
        expect(db.getAllEntries('table1')).toHaveProperty(t1EntryId)
        expect(db.getAllEntries('table1')[t1EntryId]).toEqual(t1Entry)
        expect(db.getAllEntries('table1')).toHaveProperty(t1EntryId)
        expect(db.getAllEntries('table1')[t1EntryId]).toEqual(t1Entry)
    })

    test('Get database path', () => {
        expect(db.path()).toEqual(tPath)
    })
})

describe('Queries', () => {
    test('Find by id', (done) => {
        db.findById('table1', t1EntryId, (err, entry) => {
            if (err) done(err)
            expect(entry).toEqual(t1Entry)
            done()
        })
        db.findById('table1', '0', (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toEqual('0')
        })
    })
    
    test('Delete by id', (done) => {
        db.deleteById('table1', t1EntryId, (err) => {
            if (err) done(err)
            expect(db.tables().table1).toStrictEqual({})
            db.deleteById('table2', t2EntryId, (err) => {
                if (err) done(err)
                expect(db.tables().table2).toStrictEqual({})
                done()
            })
        })
        db.deleteById('table1' ,'0', (err) => {
            expect(err).toBeDefined()
            done()
        })
    })
})

describe('Faker', () => {
    test('Faker', () => {
        let fakeQuant = 100
        let fakeDB = jsldb.relational('fake', {
            people: {
                name: {
                    type: 'string',
                    required: true
                },
                title: {
                    type: 'string',
                    required: true
                },
                username: {
                    type: 'string',
                    required: true
                },
                phone: {
                    type: 'string',
                    required: true
                }
            }
        })
        for (var i = 0; i < fakeQuant; i++) {
            let originalEntry = {
                name: faker.fake('{{name.firstName}} {{name.lastName}}'),
                title: faker.name.jobTitle(),
                username: faker.internet.userName(),
                phone: faker.phone.phoneNumber()
            }
            fakeDB.insert('people', originalEntry, (err, newEntry) => {
                expect(err).toBeNull()
                originalEntry._id = newEntry._id
                expect(newEntry).toEqual(originalEntry);
            })
        }
        expect(Object.size(fakeDB.getAllEntries('people'))).toEqual(fakeQuant)
    })
})

if (fs.existsSync(tPath))
    fs.unlinkSync(tPath)
if (fs.existsSync(`${tPath}.old`))
    fs.unlinkSync(`${tPath}.old`)