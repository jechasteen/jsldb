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
    const _static = require('./static')
    const supportedTypes = ['number', 'string', 'date']
    const _public = {}
    const _private = {}
    let db = {}
    db.path = undefined

    function setPath () {
        db.path = path.join(baseDir, `${name}.db.json`)
    }

    // set default options if undefined
    (() => {
        const defaultOptions = {
            backup: true,
            backupUnique: true
        }

        if (options === undefined || options === null) {
            options = {}
        }

        for (var key in defaultOptions) {
            if (options[key] === undefined || options[key] === null) {
                options[key] = defaultOptions[key]
            }
        }
    })()

    setPath()

    _private.checkArrayOfType = (type, array) => {
        if (!array) return true
        if (array instanceof Array && array.length === 0) return true
        let ret = true
        array.forEach((v) => {
            if (!_static.checkType[type](v)) {
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
            return (_static.checkType[type] && _static.checkType[type](value))
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

    _private.validateResult = (result) => {
        const ret = []
        if (result instanceof Array) {
            if (!result.length || (result.length === 1 && !result[0].length)) return null
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
        const sch = db.schemas[table]
        for (var field in sch) {
            if (!_private.checkField(sch[field].type, entry[field])) return false
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
            if (!Object.prototype.hasOwnProperty.call(table[key], 'type') ||
                table[key].type === undefined || table[key].type === null) {
                throw new Error(`'${table}' '${key}' has undefined type`)
            }
            if ((table[key].type instanceof Array)) {
                throw new Error(`To create an array type, pass 'array ${table[key].type[0] || 'type'}'`)
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

    _public.find = (query, findOptions, cb) => {
        if (typeof findOptions === 'function') cb = findOptions
        if (findOptions && (typeof findOptions !== 'object' && typeof findOptions !== 'function')) {
            throw new Error('Second parameter to find was neither an Options object or a callback function.')
        }
        if (cb && typeof cb !== 'function') throw new Error('Callback parameter to find* must be function type.')
        if (!findOptions || !findOptions.queryLogic) {
            if (!findOptions) findOptions = {}
        }
        if (!findOptions.queryLogic) {
            findOptions.queryLogic = 'AND'
        }
        if (!findOptions.n) {
            findOptions.n = Infinity
        }

        let ret = {}
        let found = _private.execQuery(query)
        if (!found) {
            cb(null, null)
            return null
        }

        if (found.length === 1) {
            if (findOptions.n === Infinity) {
                ret = _static.convertEntryArrayToObject(db.tables[query.table], found[0])
            } else {
                ret = _static.convertEntryArrayToObject(db.tables[query.table], found[0].slice(0, findOptions.n))
            }
        } else if (found.length > 1) {
            query = query[0]
            if (findOptions.queryLogic === 'AND') {
                found = _static.AND(found)
            } else if (findOptions.queryLogic === 'OR') {
                found = _static.OR(found)
            }
            if (findOptions.n === Infinity) {
                ret = _static.convertEntryArrayToObject(db.tables[query.table], found)
            } else {
                ret = _static.convertEntryArrayToObject(db.tables[query.table], found.slice(0, findOptions.n))
            }
        }
        if (typeof cb === 'function') cb(null, ret)
        return ret
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
        if (!Object.prototype.hasOwnProperty.call(db.schemas, table)) {
            cb(new Error(`Table '${table} not found.'`))
        }
        const sch = db.schemas[table]

        for (const k in entry) {
            const checkResult = _private.checkField(sch[k].type, entry[k])
            if (!checkResult) {
                cb(new Error(`Type check failed: table ${table}, field ${sch[k]}, value ${entry[k]}`), null)
            } else {
                continue
            }
        }

        const id = _static.getUUID()
        db.tables[table][id] = entry
        db.tables[table][id]._id = id

        cb(null, db.tables[table][id])
        return Object.prototype.hasOwnProperty.call(db.tables[table], id) ?
            db.tables[table][id] : null
    }

    _public.save = (cb) => {
        if (options.backup) {
            _static.duplicateFileIfExists(db.path, true)
        }

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
        if (options.backup) {
            _static.duplicateFileIfExists(db.path, true)
        }

        const dbJSON = JSON.stringify(db)
        fs.writeFileSync(db.path, dbJSON, { encoding: 'utf8' })
        return fs.existsSync(db.path)
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
        if (!cb) throw new Error('Callback was not defined.')
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
