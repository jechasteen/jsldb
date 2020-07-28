const fs = require('fs')
const path = require('path')
const baseDir = path.dirname(require.main.filename)

const { exec, execSync } = require('child_process')

/**
 * @module relational
 * @example
 * let jsldb = require('jsldb').relational
 * let db1 = jsldb('db1', db1schema, { autosave: true })
 * let db2 = jsldb('db2, db2schema);
 * @param {string} name - The database's name. Must be unique.
 * @param {schema} schema - A Schema object that describes the table requirements.
 * @param {Object} options - Database optionals
 * @param {boolean} options.autosave - Save to file on changes
 */
module.exports = function (name, schema, options = { autosave: false }) {
    const supportedTypes = ['number', 'string', 'date']
    let db = {}
    db.autosave = options.autosave
    db.path = undefined
    setPath()
    if (fs.existsSync(db.path)) {
        connect(name)
    } else {
        create(name)
    }

    // Allows us to see if a find operation has any results
    // Private to this database type so that we don't pollute the global
    if (!Object.size) {
        Object.size = function (obj) {
            var size = 0; var key
            for (key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) size++
            }
            return size
        }
    }

    const uuidQueue = (function () {
        const uuids = []

        function handleOutput (err, stdout, stderr) {
            if (err) {
                console.log(err)
            }
            uuids.push(stdout.replace('\n', ''))
        }

        // TODO: Maybe the generation quantity should be set via process.env?
        for (var i = 0; i < 2; i++) { uuids.push(execSync('uuidgen', { encoding: 'utf8' }).replace('\n', '')) }

        return {
            get: function () {
                exec('uuidgen', handleOutput)
                return uuids.shift()
            }
        }
    })()

    /**
     * Check the value against the given type
     * @private
     * @param {string} type - The type to be checked against
     * @param {any} value - The value to check the type of
     */
    function checkField (type, value) {
        const validate = {
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

        const s = type.split(' ')

        if (!type || !value) {
            return false // we know by the point this function is called values must exist for both parameters
        }

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
                throw new Error(`Referenced table ${s[2]} does not exist.`)
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
                throw new Error(`Referenced table ${s[1]} does not exist.`)
            } else if (!db.tables[s[1]][value]) {
                throw new Error(`Referenced entry ${s[1]}::${value} does not exist`)
            } else if (db.tables[s[1]][value]) {
                return true
            }
            return false
        } else {
            return false
        }
    }

    /**
     * Load an existing database file
     * @private
     * @throws if the database given does not exist
     */
    function connect () {
        setPath()
        if (fs.existsSync(db.path)) {
            try {
                db = JSON.parse(fs.readFileSync(db.path))
                if (db.path) {
                    return true
                } else {
                    return false
                }
            } catch (e) {
                throw new Error(`Failed to load db from ${db.path}: ${e}`)
            }
        } else {
            throw new Error(`Database ${name} does not exist`)
        }
    }

    /**
     * Initialize a new database.
     * This should be done with a new require() call for each database to be created.
     * @private
     * @throws if the database given already exists, or if table verification returns a check error.
     * @returns {boolean} - true if the database creation completed successfully. Undefined otherwise.
     */
    function create () {
        setPath()
        if (fs.existsSync(db.path)) {
            throw new Error(`Database ${name} already exists`)
        } else {
            verifyTables(schema, (err, data) => {
                if (err) {
                    console.log(err)
                } else {
                    db.schemas = data
                    db.tables = {}
                    for (const key in data) {
                        db.tables[key] = {}
                    }
                }
            })
        }
        return true
    }

    /**
     * Delete an entry by id.
     * @instance
     * @param {string} table - The table to be targeted
     * @param {number} id - The id of the entry to be deleted
     * @param {callback} cb - A callback function (error?)
     */
    function deleteById (table, id, cb = () => {}) {
        const result = delete db.tables[table][id]
        if (result) {
            cb(null)
        } else {
            cb(new Error(`Delete entry failed: ${table}:${id}`))
        }
        if (db.autosave) {
            exports.save()
        }
    }

    /**
     * If the JSON file already exists, make a backup
     * @private
     */
    function duplicateFileIfExists () {
        if (fs.existsSync(db.path)) {
            fs.copyFileSync(db.path, path.join(db.path + '.old'))
        }
    }

    /**
     * Query a table using query object. Finds ALL matching entries
     * The currently supported query type is `fieldName: 'valueToMatch'`
     * @tutorial queries
     * @instance
     * @example
     * let james = db.find('people', { name: "Jame" });
     * james.forEach( (jame) => {
     *     console.log(`${jame.firstname} ${jame.lastname} has a great head of hair.`);
     * });
     * @param {string} tableName - The name of the table to be queried
     * @param {object} query - An object composed of the `field: value` pairs to be matched. An empty object `{}` results in the whole table being returned.
     * @param {function} cb - Callback function (error?, resultsObject)
     */
    function find (tableName, query, cb) {
        if (query === {}) {
            cb(db.tables[tableName])
        }

        const fields = (() => {
            const f = []
            for (const key in db.schemas[tableName]) {
                f.push(key)
            }
            return f
        })()

        for (const key in query) {
            if (fields.indexOf(key) > -1 || key === 'any') {
                const results = findAll(tableName, key, query[key])
                if (Object.size(results) > 0) {
                    cb(null, results)
                } else {
                    cb(null, undefined)
                }
            } else {
                cb(
                    new Error(`Query field (${key}) does not exist in ${tableName}`),
                    null
                )
            }
        }
    }

    /**
     * Fetch an entry by its id
     * @instance
     * @param {string} table - The table to be targeted
     * @param {number} id - The id of the entry to be retrieved
     * @param {function} cb - Callback function. (error?, foundEntry?)
     * @returns {object} - The object which was found, or, if not found, undefined;
     */
    function findById (table, id, cb = () => {}) {
        if (typeof cb !== 'function') { throw new Error('Callback parameter to findById does not have type function.') }
        const found = db.tables[table][id]
        if (found) {
            cb(null, found)
        } else {
            cb(new Error(`Entry (${table}:${id}) not found.`), id)
        }
        return found
    }

    /**
     * Get all entries in the named table
     * @instance
     * @param {string} table - The table name
     * @returns {Object} - All entries in the named table
     */
    function getAllEntries (table) {
        return db.tables[table]
    }

    /**
     * Add a new entry to a table.
     * The `_id` is a UUID and is created automatically.
     * @instance
     * @example
     * TODO
     * @param {string} table - The name of the table to add to.
     * @param {Object} entry - An object that conforms to the schema specified in the tables object
     * @param {function} cb - Callback function (error?, newEntry?)
     * @returns {boolean} - The result of the insertion operation. A check error if the check failed, or false if not.
     * @throws if the type check fails.
     */
    function insert (table, entry, cb = () => {}) {
        const schema = db.schemas[table]

        for (const k in entry) {
            if (!schema[k]) cb(new Error(`Schema key ${k} has no type`))
            if (!checkField(schema[k].type, entry[k])) {
                cb(new Error(`Field Check failed for table ${table}, key: ${k}, value: ${entry[k]}, type: ${schema[k].type}`))
            } else {
                continue
            }
        }

        const id = uuidQueue.get()
        db.tables[table][id] = entry
        db.tables[table][id]._id = id

        if (db.autosave) {
            exports.save()
        }

        cb(null, db.tables[table][id])
        return false
    }

    /**
     * Asynchronously write the database object in memory to file
     * @instance
     * @async
     * @param {function} cb An optional callback with one parameter (error?) that runs after the write operation.
     */
    function save (cb) {
        duplicateFileIfExists()

        const dbJSON = JSON.stringify(db)
        if (typeof cb === 'function') {
            fs.writeFile(db.path, dbJSON, { encoding: 'utf8' }, cb)
        } else {
            fs.writeFile(db.path, dbJSON, { encoding: 'utf8' }, (err) => {
                if (err) throw new Error(`Failed to save ${db.path}: err`)
                else {
                    console.log(`Sucessfully saved ${db.path}`)
                }
            })
        }
    }

    /**
     * Synchronously write the database object in memory to file
     * @instance
     * @returns {boolean} - The result of the operation.
     */
    function saveSync () {
        duplicateFileIfExists()

        const dbJSON = JSON.stringify(db)
        fs.writeFileSync(db.path, dbJSON, { encoding: 'utf8' })
        if (fs.existsSync(db.path)) {
            return true
        } else {
            return false
        }
    }

    /**
     * Set the path member according to the name parameter
     * @private
     */
    function setPath () {
        db.path = path.join(baseDir, `${name}.db.json`)
    }

    /**
     * Overwrite the value for an existing field in the entry matching id.
     * @instance
     * @param {string} table - The table to be searched
     * @param {number} id - The id to be selected
     * @param {string} field - The field to be overwritten
     * @param {any} value - The value to be written. Must conform to schema.
     * @param {function} cb - A callback to be run after the set operation. (error?, changedEntry?)
     * @returns {boolean} - The result of the set operation.
     */
    function setFieldById (table, id, field, value, cb = () => {}) {
        if (checkField(db.schemas[table][field].type, value)) {
            if (Object.prototype.hasOwnProperty.call(db.tables[table], id)) {
                db.tables[table][id][field] = value
                cb(null, db.tables[table][id])
            } else {
                cb(new Error(`${id} does not exist in ${table}.`), null)
                return false
            }
            if (db.autosave) {
                exports.save()
            }
            return true
        } else {
            cb(new Error(`Field type check failed: (Field: ${field}, Value: ${value}, Type: ${db.schemas[table][field].type})`), null)
            return false
        }
    }

    /**
     * Checks the fields object for errors. If successful, the first parameter passed will be true, and the second will contain
     * a verified object. If it fails, it will return false as the first parameter, and the failed type text as a string.
     * @private
     * @param {object} inputTables - A schema object used to create and verify db entries. This object is passed to create()
     * @param {function} cb - Function has the arguments (error?, verifiedTables?)
     */
    function verifyTables (inputTables, cb) {
        const tables = []
        const tableNames = []

        for (const key in inputTables) {
            tables.push(inputTables[key])
            tableNames.push(key);
        }

        tables.forEach((table) => {
            for (const key in table) {
                if (!table[key].type) {
                    throw Error(`Table attribute '${key}' has undefined type`)
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

    return {
        deleteById: deleteById, 
        find: find,
        findById: findById,
        getAllEntries: getAllEntries,
        insert: insert,
        path: function () { return db.path },
        save: save,
        saveSync: saveSync,
        setFieldById: setFieldById,
        tables: function () { return db.tables }
    }
}
