const fs = require('fs')
const jsldb = require('../')
const Query = jsldb.Query
const path = require('path')
const faker = require('faker')

const tPath = path.join(__dirname, 'test.db.json')

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

    test('saveSync', () => {
        expect(db.saveSync()).toBeTruthy()
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
        expect(db.insert('table1', t1Entry2, (err, entry) => {
            if (err) done(err)
            t1Entry2Id = entry._id
            t1Entry2._id = entry._id
            expect(entry).toBe(t1Entry2)
            done()
        })).toBeTruthy()
    })

    describe('Entry type check', () => {
        test('Insert a broken entry (number)', () => {
            const entry = {
                number: 'string',
                string: 'string',
                date: new Date(),
                idLink: 'id table1'
            }
            expect(() => {
                db.insert('table1', entry, (err, newEntry) => {
                    expect(err).toBeDefined()
                    expect(newEntry).toBeNull()
                })
            }).toThrow()
        })

        test('Insert a broken entry (string)', () => {
            const entry = {
                number: 42,
                string: 42,
                date: new Date(),
                idLink: 'id table1'
            }
            expect(() => {
                db.insert('table1', entry, (err, newEntry) => {
                    expect(err).toBeDefined()
                    expect(newEntry).toBeNull()
                })
            }).toThrow()
        })

        test('Insert a broken entry (date)', (done) => {
            const entry = {
                number: 42,
                string: 'string',
                date: 0,
                idLink: 'id table1'
            }
            expect(() => {
                db.insert('table1', entry, (err, newEntry) => {
                    expect(err).toBeDefined()
                    expect(newEntry).toBeNull()
                    done()
                })
            }).toThrow()
        })

        test('Insert broken entry (id)', () => {
            const entry = {
                number: 42,
                string: 'string',
                date: new Date(),
                idLink: 'id table3'
            }
            expect(() => {
                db.insert('table1', entry)
            }).toThrow()
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

    test('Table 1 should be size 2, table 2 should be size 1.', () => {
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

describe('insertion errors', () => {
    test('callback defined but not function type should throw', () => {
        expect(() => {
            db.insert('table', t1Entry, 'notafunction')
        }).toThrow()
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
                new Query('table1', 'string', 'eq', 'hello'),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - regex', (done) => {
            db.findAll(
                new Query('table1', 'string', 'regex', RegExp(/^hell/)),
                (err, entries) => {
                    expect(err).toBe(null)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - eq: number', (done) => {
            db.findAll(
                new Query('table1', 'number', 'eq', 42),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findAll - gt: number', (done) => {
            db.findAll(
                new Query('table1', 'number', 'gt', 42),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })

        test('findAll - lt: number', (done) => {
            db.findAll(
                new Query('table1', 'number', 'lt', 100),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })

        test('findall - lt: number (multiple results)', (done) => {
            db.findAll(
                new Query('table1', 'number', 'lt', 200),
                (err, entries) => {
                    expect(err).toBeNull()
                    expect(Object.size(entries)).toBe(2)
                    done()
                }
            )
        })

        test('findAll - gte: number', (done) => {
            db.findAll(
                new Query('table1', 'number', 'gte', 42),
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
                new Query('table1', 'number', 'lte', 105),
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
                new Query('table2', 'numberArray', 'contains', 2),
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t2EntryId]).toEqual(t2Entry)
                    done()
                }
            )
        })

        test('findAll multiple rules - gt / lt', (done) => {
            db.findAll(
                [
                    new Query('table1', 'number', 'gt', 41),
                    new Query('table1', 'number', 'lt', 106)
                ],
                (err, entries) => {
                    if (err) done(err)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    done()
                }
            )
        })
    })

    describe('findAny', () => {
        // It's relatively pointless to use this function like this, but it is supported
        test('find a table1 entry', (done) => {
            db.findAny(
                new Query('table1', 'number', 'eq', 42),
                (err, entries) => {
                    expect(err).toBeNull()
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    done()
                }
            )
        })
        test('find both table1 entries', (done) => {
            db.findAny([
                new Query('table1', 'number', 'eq', 42),
                new Query('table1', 'number', 'eq', 105)
            ], (err, entries) => {
                expect(err).toBeNull()
                expect(entries[t1EntryId]).toEqual(t1Entry)
                expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                done()
            })
        })

        test('find with no results should return null, and pass null as both params to the callback', (done) => {
            expect((() => {
                return db.findAny(
                    new Query('table1', 'number', 'eq', 41),
                    (err, entries) => {
                        expect(err).toBeNull()
                        expect(entries).toBeNull()
                        done()
                    }
                )
            })()).toBeNull()
        })
    })

    describe('findN type', () => {
        test('findN should return number of entries matching n', (done) => {
            db.findN(2,
                new Query('table1', 'number', 'lt', 106),
                (err, entries) => {
                    expect(err).toBeNull()
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    expect(Object.size(entries)).toEqual(2)
                    done()
                })
        })
        test('findAnyN should return number of entries matching n', (done) => {
            db.findAnyN(
                2, [
                    new Query('table1', 'number', 'gt', 42),
                    new Query('table1', 'string', 'eq', 'hello')
                ],
                (err, entries) => {
                    expect(err).toBeNull()
                    expect(entries[t1EntryId]).toEqual(t1Entry)
                    expect(entries[t1Entry2Id]).toEqual(t1Entry2)
                    expect(Object.size(entries)).toEqual(2)
                    done()
                })
        })
    })

    describe('find1', () => {
        test('should return an object with 1 member', (done) => {
            const res = db.find1(
                new Query('table1', 'number', 'lt', 200),
                (err, entry) => {
                    expect(err).toBeDefined()
                    expect(Object.size(entry)).toEqual(1)
                    done()
                }
            )
            expect(Object.size(res)).toEqual(1)
        })
    })

    describe('find Errors', () => {
        const fakeQuery = new Query('table1', 'number', 'eq', 42)
        const optionsTemplate = [
            ['n', 'Infinity'],
            ['queryLogic', 'AND']
        ]

        describe('find() parameter tests', () => {
            test('second paramater can be an object or a function', () => {
                expect(() => {
                    db.find(fakeQuery, 9)
                }).toThrow()
                expect(() => {
                    db.find(fakeQuery, {}, 9)
                }).toThrow()
            })
            test('callback parameter should be function type', () => {
                expect(() => {
                    db.find(fakeQuery, {}, 9)
                }).toThrow()
            })

            describe('if second parameter is an object, does it fill missing ones?', () => {
                const opt = Object.fromEntries(optionsTemplate)
                opt.queryLogic = undefined
                test('options.queryLogic', () => {
                    db.find(fakeQuery, opt)
                    expect(opt).toMatchObject(Object.fromEntries(optionsTemplate))
                })
            })
        })

        describe('Common find* errors', () => {
            test('query parameter should be instance of Query', () => {
                expect(() => {
                    db.findAll(9)
                }).toThrow()
                expect(() => {
                    db.find1(9)
                }).toThrow()
            })

            test('query parameter should be an array of instances of Query', () => {
                expect(() => {
                    db.findAll([9])
                }).toThrow()
                expect(() => {
                    db.find1([9])
                })
            })

            test('cb parameter should be of type function or undefined', () => {
                expect(() => {
                    db.findAll(fakeQuery, 9)
                }).toThrow()
                expect(() => {
                    db.find1(fakeQuery, 9)
                }).toThrow()
            })
        })
    })
})

describe('update operations', () => {
    test('updateById', (done) => {
        db.updateById('table1', t1EntryId, (err, entry) => {
            if (err) done(err)
            entry.string = 'newString'
            entry.save()
            t1Entry.string = 'newString'
            db.findById('table1', t1EntryId, (e, foundEntry) => {
                if (e) done(e)
                expect(foundEntry.string).toEqual('newString')
                done()
            })
        })
    })

    test('updateById error', (done) => {
        expect(() => {
            db.updateById('table1', t1EntryId, (err, entry) => {
                if (err) done(err)
                entry.string = 42
                entry.save()
            })
        }).toThrow()

        db.findById('table1', t1EntryId, (err, entry) => {
            expect(err).toBeDefined()
            expect(entry).toEqual(t1Entry)
            done()
        })
    })
})

describe('delete operations', () => {
    test('deleteById', (done) => {
        db.deleteById('table1', t1EntryId, (e) => {
            if (e) done(e)
            db.deleteById('table1', t1Entry2Id, (er) => {
                if (er) done(er)
                expect(db.tables().table1).toStrictEqual({})
                db.deleteById('table2', t2EntryId, (err) => {
                    if (err) done(err)
                    expect(db.tables().table2).toStrictEqual({})
                    done()
                })
            })
        })
    })

    test('deleteById (non-existent)', (done) => {
        db.deleteById('table1', '0', (err) => {
            expect(err).toBeDefined()
            done()
        })
    })

    test('deleteById cb parameter should be function type', () => {
        expect(() => {
            db.deleteById('table1', t1EntryId, 0)
        }).toThrow()
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

afterAll(cleanup)

function cleanup () {
    if (fs.existsSync(tPath)) fs.unlinkSync(tPath)
    if (fs.existsSync(`${tPath}.old`)) fs.unlinkSync(`${tPath}.old`)
}
