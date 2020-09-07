const fs = require('fs')
const Query = require('../src/query')

const privSchema = {
    table: {
        stringField: {
            type: 'string',
            required: true
        },
        numberField: {
            type: 'number',
            required: true
        },
        dateField: {
            type: 'date',
            required: true
        },
        idField: {
            type: 'id table'
        },
        arrayIdField: {
            type: 'array id table'
        }
    }
}
const db = require('../').relational('priv', privSchema)
const priv = db.__test__

let entry1 = {
    stringField: 'string',
    numberField: 42,
    dateField: new Date()
}

let entry2 = {
    stringField: 'string also',
    numberField: 50,
    dateField: new Date()
}

beforeAll(() => {
    db.insert('table', entry1, (err, newEntry) => {
        if (err) return err
        entry1 = newEntry
    })
    db.insert('table', entry2, (err, newEntry) => {
        if (err) return err
        entry2 = newEntry
    })
    db.updateById('table', entry1._id, (err, entry) => {
        if (err) return err
        entry.idField = entry2._id
        entry.arrayIdField = [entry2._id]
    })
    db.updateById('table', entry2._id, (err, entry) => {
        if (err) return err
        entry.idField = entry1._id
        entry.arrayIdField = [entry1._id]
    })
})

describe('checkArrayOfType', () => {
    test('A zero length array, null, or undefined should pass', () => {
        expect(priv.checkArrayOfType('string', [])).toBeTruthy()
        expect(priv.checkArrayOfType('string', null)).toBeTruthy()
        expect(priv.checkArrayOfType('string', undefined)).toBeTruthy()
    })
    test('Each item in an array must match type', () => {
        expect(priv.checkArrayOfType('number', [3, 4, 5])).toBeTruthy()
        expect(priv.checkArrayOfType('number', [3, 5, 'a'])).toBeFalsy()
        expect(priv.checkArrayOfType('number', [3, 5, false])).toBeFalsy()
    })
})

describe('checkArrayOfIds', () => {
    // TODO: Test that an _id is actually a valid UUID
    test('non-existent table ref should throw', () => {
        expect(() => {
            priv.checkArrayOfIds('fake')
        }).toThrow()
    })

    test('expect a non-array value to throw', () => {
        expect(() => {
            priv.checkArrayOfIds('table', entry1._id)
        }).toThrow()
    })

    test('expect a non-existent entry to throw', () => {
        expect(priv.checkArrayOfIds('table', ['d4f4d09b-7eec-4bd6-808a-35f26089421d'])).toBeFalsy()
    })
})

describe('checkIdRef', () => {
    test('table should exist', () => {
        expect(() => {
            priv.checkIdRef('fake', 'fake')
        }).toThrow()
    })
    test('undefined value should return true', () => {
        expect(priv.checkIdRef('fake', undefined)).toBeTruthy()
    })
})

describe('create', () => {
    expect(priv.connect()).toBeFalsy()
    expect(db.saveSync()).toBeTruthy()
    expect(priv.connect()).toBeTruthy()
})

describe('execQuery', () => {
    test('No found entries should return null', () => {
        expect(priv.execQuery(new Query('table', 'number', 'eq', 0))).toBeNull()
    })
})

describe('validateResult', () => {
    test('[] should return null', () => {
        expect(priv.validateResult([])).toBeNull()
    })

    test('[[]] should return null', () => {
        expect(priv.validateResult([[]])).toBeNull()
    })
    test('[[], []] should return null', () => {
        expect(priv.validateResult([[], []])).toBeNull()
    })
    test('undefined should return null', () => {
        expect(priv.validateResult(undefined)).toBeNull()
    })
})

describe('convertArrayToObject', () => {
    test('return value should be object or null', () => {
        const fakeQ = new Query('table', 'string', 'eq', 0)
        const shouldLookLike = (() => {
            const ret = {}
            ret[entry1._id] = entry1
            ret[entry2._id] = entry2
            return ret
        })()
        expect(priv.convertEntryArrayToObject(fakeQ, [entry1._id, entry2._id]))
            .toMatchObject(shouldLookLike)
    })
})

describe('checkTableArrayOrId', () => {
    test('type === array with unsupported type should throw', () => {
        expect(() => {
            priv.checkTableArrayOrId('array', 'unsupported', ['table'])
        }).toThrow()
    })

    test('type === array with supported type should return true', () => {
        expect(priv.checkTableArrayOrId('array', 'number', ['table'])).toBeTruthy()
    })

    test('passing neither id nor array to type param should throw', () => {
        expect(() => {
            priv.checkTableArrayOrId('wrong', 'number', ['table'])
        }).toThrow()
    })
})

describe('checkTable', () => {
    test('fields should have a type field and it should not be null or undefined', () => {
        expect(() => {
            priv.checkTable('fake', { table: {} })
        }).toThrow()

        expect(() => {
            priv.checkTable('fake', { table: { type: undefined } })
        }).toThrow()

        expect(() => {
            priv.checkTable('fake', { table: { type: null } })
        }).toThrow()
    })
})

describe('insert', () => {
    test('named table should exist', () => {
        expect(() => {
            priv.insert('fake')
        }).toThrow()
    })
})

describe('verifyTables', () => {
    test('callback parameter with other than function type should throw', () => {
        expect(() => {
            priv.verifySchema(privSchema, 0)
        }).toThrow()
    })
})

afterAll(() => {
    if (fs.existsSync(db.path())) {
        fs.unlinkSync(db.path())
    }
})
