const fs = require('fs')
const path = require('path')
const Query = require('./query')
const baseDir = path.dirname(require.main.filename)

// Allows us to see if a find operation has any results
if (!Object.size) {
    Object.size = function (obj) {
        var size = 0; var key
        for (key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) size++
        }
        return size
    }
}

module.exports = function (name, schema, options) {
    const supportedTypes = ['number', 'string', 'date']
    const _public = {}
    const _private = {}
    let db = {}
    db.path = undefined

    function setPath () {
        db.path = path.join(baseDir, `${name}.db.json`)
    }

    setPath()

    // Borrowed from faker sources because it's a fabulous method for javascript
    // https://github.com/Marak/faker.js/blob/master/lib/random.js
    _private.getUUID = () => {
        var RFC4122_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        var replacePlaceholders = function (placeholder) {
            var random = Math.round(Math.random() * 15)
            var value = placeholder === 'x' ? random : (random & 0x3 | 0x8)
            return value.toString(16)
        }
        return RFC4122_TEMPLATE.replace(/[xy]/g, replacePlaceholders)
    }

    _private.validate = {
        number: (val) => {
            return typeof val === 'number'
        },
        string: (val) => {
            return typeof val === 'string'
        },
        date: (val) => {
            return val instanceof Date
        }
    }

    _private.checkArrayOfType = (type, array) => {
        if (!array || array === undefined || array === null) return true
        if (array instanceof Array && array.length === 0) return true
        let ret = true
        array.forEach((v) => {
            if (!_private.validate[type](v)) {
                ret = false
            }
        })
        return ret
    }

    _private.checkArrayOfIds = (table, value) => {
        let ret = true
        if (!Object.prototype.hasOwnProperty.call(db.tables, table)) {
            throw new Error(`Referenced table ${table} does not exist.`)
        } else {
            if (value instanceof Array) {
                value.forEach((v) => {
                    if (!Object.prototype.hasOwnProperty.call(db.tables[table], v)) {
                        ret = false
                    }
                })
            } else {
                throw new Error(`Type 'array id ${table} expects an instance of Array.`)
            }
        }
        return ret
    }

    _private.checkIdRef = (table, value) => {
        if (!value) return true
        if (!Object.prototype.hasOwnProperty.call(db.tables, table)) {
            throw new Error(`Referenced table ${table} does not exist.`)
        } else if (!Object.prototype.hasOwnProperty.call(db.tables[table], value)) {
            throw new Error(`Referenced entry ${table}:${value} does not exist`)
        } else if (db.tables[table][value]) {
            return true
        }
    }

    _private.checkField = (type, value) => {
        const s = type.split(' ')

        if (s.length === 1) {
            // Simple type
            if (_private.validate[type] && _private.validate[type](value)) return true
            else return false
        } else if (
            s[0] === 'array' &&
            s[1] !== 'id' &&
            supportedTypes.indexOf(s[1]) >= 0
        ) {
            return _private.checkArrayOfType(s[1], value)
        } else if (s[0] === 'array' && s[1] === 'id') {
            return _private.checkArrayOfIds(s[2], value)
        } else if (s[0] === 'id') {
            return _private.checkIdRef(s[1], value)
        }
    }

    _private.connect = () => {
        setPath()
        if (db.path && fs.existsSync(db.path)) {
            try {
                db = JSON.parse(fs.readFileSync(db.path))
                return true
            } catch (e) {
                throw new Error(`Failed to load db ${name}: ${e}`)
            }
        } else return false
    }

    _private.create = () => {
        setPath()
        _private.verifySchema(schema, (data) => {
            db.schemas = data
            db.tables = {}
            for (const key in data) {
                db.tables[key] = {}
            }
        })
        return true
    }

    _private.AND = (arr) => {
        const common = []
        while (arr.length > 1) {
            for (var i in arr[0]) {
                for (var j in arr[1]) {
                    if (arr[0][i] === arr[1][j] && common.indexOf(arr[0][i] === -1)) {
                        common.push(arr[0][i])
                    }
                }
            }
            arr.shift()
            arr[0] = common
        }
        return common
    }

    _private.OR = (arr) => {
        const all = []
        for (var i in arr) {
            for (var j in arr[i]) {
                if (all.indexOf(arr[i][j]) === -1) {
                    all.push(arr[i][j])
                }
            }
        }
        return all
    }

    _private.validateResult = (result) => {
        const ret = []
        if (result instanceof Array) {
            if (!result.length) return null
            else if (result.length === 1 && !result[0].length) return null
            for (var i in result) {
                if (result[i].length) ret.push(result[i])
            }
            if (!ret.length) return null
            else return ret
        }
        return null
    }

    _private.execQuery = (query) => {
        const found = []
        if (query instanceof Query) {
            found.push(_private.search(db.tables[query.table], query.field, query.fn, query.val))
        } else if (query instanceof Array) {
            for (var q in query) {
                if (!query[q] || !(query[q] instanceof Query)) {
                    throw new Error('Queries must be instances of the Query object.')
                }
                found.push(_private.search(db.tables[query[q].table], query[q].field, query[q].fn, query[q].val))
            }
        } else {
            throw new Error('Query parameter must be either an array of Query objects, or a single Query object.')
        }
        return _private.validateResult(found)
    }

    _private.convertEntryArrayToObject = (query, ids) => {
        const ret = {}
        for (var i in ids) {
            ret[ids[i]] = db.tables[query.table][ids[i]]
        }
        return Object.size(ret) === 0 ? null : ret
    }

    _private.duplicateFileIfExists = () => {
        if (fs.existsSync(db.path)) {
            fs.copyFileSync(db.path, path.join(db.path + '.old'))
        }
    }

    _private.search = (table, field, matchFn, search) => {
        const found = []
        for (var key in table) {
            const cur = table[key]
            if (typeof search === 'string' ||
                    typeof search === 'number') {
                if ((matchFn === 'eq' && cur[field] === search) ||
                        (matchFn === 'gt' && cur[field] > search) ||
                        (matchFn === 'lt' && cur[field] < search) ||
                        (matchFn === 'gte' && cur[field] >= search) ||
                        (matchFn === 'lte' && cur[field] <= search) ||
                        (matchFn === 'contains' && cur[field] instanceof Array && cur[field].includes(search))) {
                    found.push(key)
                }
            } else if (matchFn === 'regex' &&
                    search instanceof RegExp &&
                    typeof cur[field] === 'string' &&
                    cur[field].match(search)) {
                found.push(key)
            }
        }
        return found
    }

    _private.validateEntry = (table, entry) => {
        const schema = db.schemas[table]
        for (var field in schema) {
            if (!_private.checkField(schema[field].type, entry[field])) return false
        }
        return true
    }

    _private.checkTableBasicType = (field) => {
        if (supportedTypes.indexOf(field.type) < 0) {
            throw new Error(`Not a supported type: ${field.type}.`)
        } else {
            return true
        }
    }

    _private.checkTableArrayOrId = (type, target, tableNames) => {
        if (type === 'id') {
            if (tableNames.indexOf(target) < 0) {
                throw new Error(`Table ${target} does not exist.`)
            } else {
                return true
            }
        } else if (type === 'array') {
            if (supportedTypes.indexOf(target) < 0) {
                throw new Error(`Not a supported type: ${target}.`)
            } else {
                return true
            }
        } else {
            throw new Error(`Failed to parse table target type: ${type} ${target}`)
        }
    }

    _private.checkTableArrayId = (table, tableNames) => {
        if (tableNames.indexOf(table) < 0) {
            throw new Error(`Table ${table} does not exist.`)
        } else {
            return true
        }
    }

    _private.checkTable = (table, tableNames) => {
        for (var key in table) {
            if (!table[key].type) {
                throw new Error(`'${table}' '${key}' has undefined type`)
            }
            const s = table[key].type.split(' ')
            const field = table[key]
            if (s.length === 1) {
                // "${type}"
                _private.checkTableBasicType(field)
            } else if (s.length === 2) {
                // either "array ${type}" or "id ${table}"
                _private.checkTableArrayOrId(s[0], s[1], tableNames)
            } else if (s.length === 3) {
                // "array id ${table}"
                _private.checkTableArrayId(s[2], tableNames)
            }
        }
    }

    _private.verifySchema = (inputSchema, cb) => {
        if (typeof cb !== 'function') throw new Error('Callback parameter must be function type.')
        const tables = []
        const tableNames = []

        for (const key in inputSchema) {
            tables.push(inputSchema[key])
            tableNames.push(key)
        }
        // If this forEach succeeds without throwing, the tables object is valid
        tables.forEach((table) => {
            _private.checkTable(table, tableNames)
        })
        cb(inputSchema)
    }

    _public.deleteById = (table, id, cb) => {
        if (cb && typeof cb !== 'function') throw new Error('Callback parameter to deleteById, if defined, must be function type')
        if (Object.prototype.hasOwnProperty.call(db.tables[table], id)) {
            delete db.tables[table][id]
            cb(null)
            return null
        } else {
            const err = new Error(`Table has no entry with id ${id}`)
            cb(err)
            return err
        }
    }

    _public.find = (query, options, cb) => {
        if (typeof options === 'function') cb = options
        if (options && (typeof options !== 'object' && typeof options !== 'function')) {
            throw new Error('Second parameter to find was neither an Options object or a callback function.')
        }
        if (cb && typeof cb !== 'function') throw new Error('Callback parameter to find* must be function type.')
        if (!options || !options.queryLogic) {
            if (!options) options = {}
        }
        if (!options.queryLogic) {
            options.queryLogic = 'AND'
        }
        if (!options.n) {
            options.n = Infinity
        }

        if (options.queryLogic === 'id' && typeof query === 'string' && typeof options === 'string') {
            return _public.findById(query, options, cb)
        } else {
            let ret = {}
            let found = _private.execQuery(query)
            if (!found) {
                cb(null, null)
                return null
            }

            if (found.length === 1) {
                if (options.n === Infinity) {
                    ret = _private.convertEntryArrayToObject(query, found[0])
                } else {
                    ret = _private.convertEntryArrayToObject(query, found[0].slice(0, options.n))
                }
            } else if (found.length > 1) {
                query = query[0]
                if (options.queryLogic === 'AND') {
                    found = _private.AND(found)
                } else if (options.queryLogic === 'OR') {
                    found = _private.OR(found)
                }
                if (options.n === Infinity) {
                    ret = _private.convertEntryArrayToObject(query, found)
                } else {
                    ret = _private.convertEntryArrayToObject(query, found.slice(0, options.n))
                }
            }
            if (typeof cb === 'function') cb(null, ret)
            return ret
        }
    }

    _public.findAll = (query, cb) => {
        return _public.find(query, { queryLogic: 'AND' }, cb)
    }

    _public.findAny = (query, cb) => {
        return _public.find(query, { queryLogic: 'OR' }, cb)
    }

    _public.findAny1 = (query, cb) => {
        return _public.find(query, { queryLogic: 'OR', n: 1 }, cb)
    }

    _public.findAnyN = (n, query, cb) => {
        return _public.find(query, { queryLogic: 'OR', n: n }, cb)
    }

    _public.findById = (table, id, cb) => {
        if (cb && typeof cb !== 'function') { throw new Error('Callback parameter to findById must have function type.') }
        const found = db.tables[table][id]
        if (found) {
            cb(null, found)
        } else {
            cb(new Error(`Entry (${table}:${id}) not found.`), id)
        }
        return found
    }

    _public.findN = (n, query, cb) => {
        return _public.find(query, { queryLogic: 'AND', n: n }, cb)
    }

    _public.find1 = (query, cb) => {
        return _public.find(query, { queryLogic: 'AND', n: 1 }, cb)
    }

    _public.getAllEntries = (table) => {
        return db.tables[table]
    }

    _public.insert = (table, entry, cb) => {
        if (cb && typeof cb !== 'function') throw new Error('Callback passed to insert must be function type.')
        const schema = db.schemas[table]

        for (const k in entry) {
            const checkResult = _private.checkField(schema[k].type, entry[k])
            if (!checkResult) {
                cb(new Error(`Type check failed: table ${table}, field ${schema[k]}, value ${entry[k]}`), null)
            } else {
                continue
            }
        }

        const id = _private.getUUID()
        db.tables[table][id] = entry
        db.tables[table][id]._id = id

        cb(null, db.tables[table][id])
        return false
    }

    _public.save = (cb) => {
        _private.duplicateFileIfExists()

        const dbJSON = JSON.stringify(db)
        if (typeof cb === 'function') {
            fs.writeFile(db.path, dbJSON, { encoding: 'utf8' }, cb)
        } else {
            fs.writeFile(db.path, dbJSON, { encoding: 'utf8' }, (err) => {
                if (err) throw new Error(`Failed to save ${db.path}: err`)
            })
        }
    }

    _public.saveSync = () => {
        _private.duplicateFileIfExists()

        const dbJSON = JSON.stringify(db)
        fs.writeFileSync(db.path, dbJSON, { encoding: 'utf8' })
        if (fs.existsSync(db.path)) {
            return true
        } else {
            return false
        }
    }

    _public.setFieldById = (table, id, field, value, cb) => {
        if (cb && typeof cb !== 'function') throw new Error('Callback parameter to setFieldById must be function type')
        if (_private.checkField(db.schemas[table][field].type, value)) {
            if (Object.prototype.hasOwnProperty.call(db.tables[table], id)) {
                db.tables[table][id][field] = value
                cb(null, db.tables[table][id])
            } else {
                cb(new Error(`${id} does not exist in ${table}.`), null)
                return false
            }
            return true
        } else {
            cb(new Error(`Field type check failed: (Field: ${field}, Value: ${value}, Type: ${db.schemas[table][field].type})`), null)
            return false
        }
    }

    _public.updateById = (table, id, cb) => {
        if (typeof cb !== 'function') throw new Error('Callback parameter to updateById must be function type.')
        if (Object.prototype.hasOwnProperty.call(db.tables, table) &&
                Object.prototype.hasOwnProperty.call(db.tables[table], id)) {
            let entry = db.tables[table][id]
            const savedEntry = Object.assign({}, entry)
            const copiedEntry = Object.assign({}, entry)
            copiedEntry.save = () => {
                if (!_private.validateEntry(table, copiedEntry)) {
                    entry = savedEntry
                    throw new Error(`Failed to validate the entry -> ${entry}`)
                } else {
                    delete copiedEntry.save
                    db.tables[table][id] = copiedEntry
                }
            }
            cb(null, copiedEntry)
        }
    }

    _public.tables = () => { return db.tables }
    _public.schema = () => { return db.schema }
    _public.path = () => { return db.path }

    _public.__test__ = _private

    if (fs.existsSync(db.path)) {
        if (!_private.connect()) return null
    } else {
        if (!_private.create()) return null
    }

    return _public
}
