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

    _private.checkField = (type, value) => {
        const validate = {
            number: (val) => {
                return typeof val === 'number'
            },
            string: (val) => {
                return typeof val === 'string'
            },
            date: (val) => {
                return Date.parse(val) instanceof Date
            }
        }
        const s = type.split(' ')

        if (s.length === 1) {
            // Simple type
            if (validate[type] && validate[type](value)) return true
            else return false
        } else if (
            s[0] === 'array' &&
            s[1] !== 'id' &&
            supportedTypes.indexOf(s[1]) >= 0
        ) {
            // s[0] = 'array', s[1] 'type'
            if (value.length === 0) return true
            if (!value) return true
            const type = s[1]
            try {
                value.forEach((v) => {
                    if (!validate[type](v)) {
                        return false
                    }
                })
                return true
            } catch (e) {
                return false
            }
        } else if (s[0] === 'array' && s[1] === 'id') {
            // s[0] = 'array', s[1] = 'id', s[2] = 'tableName'
            if (!db.tables[s[2]]) {
                return new Error(`Referenced table ${s[2]} does not exist.`)
            } else {
                if (value instanceof Array) {
                    value.forEach((v) => {
                        if (!db.tables[s[2]][value]) {
                            return false
                        }
                    })
                    return true
                } else {
                    // single value
                    if (!db[s[2][value]]) {
                        return false
                    } else {
                        return true
                    }
                }
            }
        } else if (s[0] === 'id') {
            if (!value) return true
            if (!db.tables[s[1]]) {
                return new Error(`Referenced table ${s[1]} does not exist.`)
            } else if (!db.tables[s[1]][value]) {
                return new Error(`Referenced entry ${s[1]}:${value} does not exist`)
            } else if (db.tables[s[1]][value]) {
                return true
            }
        }
    }

    _private.connect = () => {
        setPath()
        try {
            db = JSON.parse(fs.readFileSync(db.path))
            if (db.path) {
                return true
            } else {
                return false
            }
        } catch (e) {
            throw new Error(`Failed to load db ${name}: ${e}`)
        }
    }

    _private.create = () => {
        setPath()
        _private.verifyTables(schema, (err, data) => {
            if (err) {
                throw err
            } else {
                db.schemas = data
                db.tables = {}
                for (const key in data) {
                    db.tables[key] = {}
                }
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
        if (found.length === 0) return null
        else return found
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

    _private.verifyTables = (inputTables, cb) => {
        const tables = []
        const tableNames = []

        for (const key in inputTables) {
            tables.push(inputTables[key])
            tableNames.push(key)
        }

        tables.forEach((table) => {
            for (const key in table) {
                if (!table[key].type) {
                    cb(Error(`Table attribute '${key}' has undefined type`))
                }
                const s = table[key].type.split(' ')
                const f = table[key]
                if (s.length === 1) {
                    // type is basic
                    if (supportedTypes.indexOf(f.type) < 0) {
                        cb(new Error(`Not a supported type: ${f.type}.`), null)
                    } else {
                        continue
                    }
                } else if (s.length === 2) {
                    // either "array ${type}" or "id ${table}"
                    if (s[0] === 'id') {
                        if (tableNames.indexOf(s[1]) < 0) {
                            return cb(new Error(`Table ${s[1]} does not exist.`), null)
                        } else {
                            continue
                        }
                    } else if (s[0] === 'array') {
                        if (supportedTypes.indexOf(s[1]) < 0) {
                            return cb(new Error(`Not a supported type: ${s[1]}.`), null)
                        } else {
                            continue
                        }
                    } else {
                        continue
                    }
                } else if (s.length === 3) {
                    // "array id ${table}"
                    if (tableNames.indexOf(s[2]) < 0) {
                        cb(new Error(`Table ${s[2]} does not exist.`), null)
                    } else {
                        continue
                    }
                }
            }
        })
        cb(null, inputTables)
    }

    _public.deleteById = (table, id, cb) => {
        if (cb && typeof cb !== 'function') throw new Error('Callback parameter to deleteById, if defined, must be function type')
        if (Object.prototype.hasOwnProperty.call(db.tables[table], id)) {
            delete db.tables[table][id]
            cb(null)
        } else {
            cb(new Error(`Table has no entry with id ${id}`))
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
            if (!found) ret = null

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
            if (!schema[k]) cb(new Error(`Schema key ${k} has no type`), null)
            const checkResult = _private.checkField(schema[k].type, entry[k])
            if (checkResult instanceof Error) {
                cb(checkResult, null)
                return
            } else if (!checkResult) {
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
            cb(null, db.tables[table][id])
            if (!_private.validateEntry(table, entry)) {
                entry = savedEntry
                throw new Error(`Failed to validate the entry -> ${entry}`)
            }
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
