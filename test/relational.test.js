const fs = require('fs')
const jsldb = require('../')
const Query = require('../src/query')
const path = require('path')
const faker = require('faker')

const tPath = path.join(__dirname, 'test/test.db.json')

const passingSchemas = {
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
            type: 'id table2'
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

let db

describe('Creation, saving, and connection', () => {
    test('Create new database', () => {
        db = jsldb.relational('test', passingSchemas)
        expect(db).toBeTruthy()
    })

    test('Creation errors', () => {
        for (var bad in failingSchemas) {
            try {
                jsldb.relational('bad', failingSchemas[bad])
            } catch (e) {
                expect(e).toBeDefined()
            }
        }
    })

    test('Save (sync)', () => {
        expect(db.saveSync()).toBe(true)
    })

    test('Connect to existing database', () => {
        db = jsldb.relational('test', passingSchemas)
        expect(db).toBeTruthy()
    })
})

let t1EntryId
let t1Entry2Id
let t2EntryId
const t1Entry = {
    number: 42,
    string: 'hello',
    date: new Date()
}
const t1Entry2 = {
    number: 105,
    string: 'hellenic',
    date: new Date()
}
const t2Entry = {
    numberArray: [1, 2],
    stringArray: ['hello', 'world'],
    dateArray: [new Date(), new Date()]
}

describe('Entry insertion and modification', () => {
    test('Insert a table1 entry', (done) => {
        db.insert('table1', t1Entry, (err, entry) => {
            if (err) done(err)
            t1EntryId = entry._id
            t1Entry._id = entry._id
            expect(entry).toBe(t1Entry)
            done()
        })
    })

    test('Insert a second table1 entry', (done) => {
        db.insert('table1', t1Entry2, (err, entry) => {
            if (err) done(err)
            t1Entry2Id = entry._id
            t1Entry2._id = entry._id
            expect(entry).toBe(t1Entry2)
            done()
        })
    })

    describe('Entry type check', () => {
        test('Insert a broken entry (number)', (done) => {
            const entry = {
                number: 'string',
                string: 'string',
                date: new Date(),
                idLink: 'id table1'
            }
            db.insert('table1', entry, (err, entry) => {
                expect(err).toBeDefined()
                expect(entry).toBeNull()
                done()
            })
        })

        test('Insert a broken entry (string)', (done) => {
            const entry = {
                number: 42,
                string: 42,
                date: new Date(),
                idLink: 'id table1'
            }
            db.insert('table1', entry, (err, entry) => {
                expect(err).toBeDefined()
                expect(entry).toBeNull()
                done()
            })
        })

        test('Insert a broken entry (date)', (done) => {
            const entry = {
                number: 42,
                string: 'string',
                date: 0,
                idLink: 'id table1'
            }
            db.insert('table1', entry, (err, entry) => {
                expect(err).toBeDefined()
                expect(entry).toBeNull()
                done()
            })
        })

        test('Insert broken entry (id)', (done) => {
            const entry = {
                number: 42,
                string: 'string',
                date: new Date(),
                idLink: 'id table3'
            }
            db.insert('table1', entry, (err, entry) => {
                expect(err).toBeDefined()
                expect(entry).toBeNull()
                done()
            })
        })

        // TODO: test failure of 'array id nonExistentTable'
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
        expect(Object.size(db.getAllEntries('table1'))).toEqual(2)
        expect(Object.size(db.getAllEntries('table2'))).toEqual(1)
    })

    // Tie the two together
    test('setFieldById - link 1->2', (done) => {
        db.setFieldById('table1', t1EntryId, 'idLink', t2EntryId, (err, entry) => {
            if (err) done(err)
            if (!entry) done('Entry came back undefined')
            expect(entry.idLink).toEqual(t2EntryId)
            done()
        })
    })

    test('setFieldById - link 2->1', (done) => {
        db.setFieldById('table2', t2EntryId, 'idLinkArray', [t1EntryId], (err, entry) => {
            if (err) done(err)
            expect(entry.idLinkArray).toEqual([t1EntryId])
            done()
        })
    })

    test('setFieldById - non-existent id', (done) => {
        db.setFieldById('table1', 0, 'number', 12, (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toBeNull()
            done()
        })
    })
    test('setFieldById - ensure file type check', (done) => {
        db.setFieldById('table1', t1EntryId, 'number', 'string', (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toBeNull()
            done()
        })
    })

    test('Save (async)', (done) => {
        db.save((err) => {
            if (err) done(err)
            expect(fs.existsSync(tPath)).toBe(true)
            done()
        })
    })
})

describe('Get raw members', () => {
    test('Get all tables', () => {
        expect(db.tables()).toHaveProperty('table1')
        expect(db.tables().table1[t1EntryId]).toEqual(t1Entry)
        expect(db.tables()).toHaveProperty('table2')
        expect(db.tables().table2[t2EntryId]).toEqual(t2Entry)
    })

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
    describe('findById', () => {
        test('Find by id', (done) => {
            db.findById('table1', t1EntryId, (err, entry) => {
                if (err) done(err)
                expect(entry).toEqual(t1Entry)
                done()
            })
        })

        test('Find by id (non-existent)', (done) => {
            db.findById('table1', '0', (err, entry) => {
                expect(err).toBeDefined()
                expect(entry).toEqual('0')
                done()
            })
        })
    })

    describe('findAll', () => {
        test('findAll - eq: string', (done) => {
            db.findAll(
                'table1',
                Query('string', 'eq', 'hello'),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - regex', (done) => {
            db.findAll(
                'table1',
                Query('string', 'regex', /^hell/),
                (err, entries) => {
                    expect(err).toBe(null)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - eq: number', (done) => {
            db.findAll(
                'table1',
                Query('number', 'eq', 42),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - gt: number', (done) => {
            db.findAll(
                'table1',
                Query('number', 'gt', 42),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })

        test('findAll - lt: number', (done) => {
            db.findAll(
                'table1',
                Query('number', 'lt', 100),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - gte: number', (done) => {
            db.findAll(
                'table1', 
                Query('number', 'gte', 42),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })

        test('findAll - lte: number', (done) => {
            db.findAll(
                'table1',
                Query('number', 'lte', 105),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })

        test('findAll - contains', (done) => {
            db.findAll(
                'table2', 
                Query('numberArray', 'contains', 2),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t2EntryId]).toEqual(t2Entry)
                    done()
                }
            )
        })

        test('findAll multiple rules - gt / lt', (done) => {
            db.findAll(
                'table1',
                [
                    Query('number', 'gt', 42),
                    Query('number', 'lt', 106)
                ],
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })
    })
})

describe('delete operations', () => {
    test('Delete by id', (done) => {
        db.deleteById('table1', t1EntryId, (err) => {
            if (err) done(err)
            db.deleteById('table1', t1Entry2Id, (err) => {
                if (err) done(err)
                expect(db.tables().table1).toStrictEqual({})
                db.deleteById('table2', t2EntryId, (err) => {
                    if (err) done(err)
                    expect(db.tables().table2).toStrictEqual({})
                    done()
                })
            })
        })
    })

    test('Delete by id (non-existent)', (done) => {
        db.deleteById('table1', '0', (err) => {
            expect(err).toBeDefined()
            done()
        })
    })
})

describe('Faker', () => {
    test('Faker', () => {
        const fakeQuant = 1000
        const fakeDB = jsldb.relational('fake', {
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
            const originalEntry = {
                name: faker.fake('{{name.firstName}} {{name.lastName}}'),
                title: faker.name.jobTitle(),
                username: faker.internet.userName(),
                phone: faker.phone.phoneNumber()
            }
            fakeDB.insert('people', originalEntry, (err, newEntry) => {
                expect(err).toBeNull()
                originalEntry._id = newEntry._id
                expect(newEntry).toEqual(originalEntry)
            })
        }
        db.save()
        expect(Object.size(fakeDB.getAllEntries('people'))).toEqual(fakeQuant)
    })
})

afterAll(() => {
    cleanup()
})

process.on('exit', (code) => {
    console.log(`Exited. Code ${code}`);
    cleanup()
})

function cleanup () {
    fs.unlinkSync(tPath)
    fs.unlinkSync(`${tPath}.old`)
}
