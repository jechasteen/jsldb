/**
 * jsldb module
 * @module jsldb
 */

const fs = require('fs');
const path = require('path');
const baseDir = path.dirname(require.main.filename);

const supportedTypes = [ 'number', 'string', 'date' ];

// Holds the database in memory once we have either created or loaded from file.
let db = {};
// Holds the path to the database JSON file
db.path = undefined;
// Holds the autosave option passed at database creation, default false. Also set after connecting to an existing db
db.autosave = false;

/**
 * Checks the fields object for errors. If successful, the first parameter passed will be true, and the second will contain
 * a verified object. If it fails, it will return false as the first parameter, and the failed type text as a string.
 * Note: this function was intended to be called when a new database is created.
 * @param {object} tables - A schema object used to create and verify db entries. This object is passed to create()
 * @param {function} cb - Function has the arguments (result: boolean, [failedType: string || passedTable: object])
 */
const verifyTables = (unverifiedTables, cb) => {
    const tables = [];

    for (let key in unverifiedTables) {
        tables.push(key);
    }

    tables.forEach( t => {
        let curTable = unverifiedTables[t]
        for (let k in curTable) {
            const s = curTable[k].type.split(' ');
            const f = curTable[k];
            if (s.length === 1) {
                // type is basic            
                if (supportedTypes.indexOf(f.type) < 0) {
                    cb(false, f.type);
                } else { 
                    continue;
                }
            } else if (s.length === 2) {
                // either "array ${type}" or "id ${table}"
                if (s[0] === 'id') {
                    if (tables.indexOf(s[1]) < 0) {
                        return cb(false, f.type);
                    } else {
                        continue;
                    }
                } else if (s[0] === 'array') { 
                    if (supportedTypes.indexOf(s[1]) < 0) {
                        return cb(false, f.type);
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            } else if (s.length === 3) {
                // "array id ${table}"
                if (tables.indexOf(s[2]) < 0) {
                    cb(false, f.type);
                } else {
                    continue;
                }
            }
        }
    });

    cb(true, unverifiedTables);
}

/**
 * Initialize a new database
 * @param {string} name - The name of the new database
 * @param {Object} tables - A [tables]{@link docs/tables} schema object
 * @param {boolean} autosave - Whether to save automatically at creation and on changes, default false
 * @throws {Error} if the database given already exists, or if verify tables returns a check error.
 * @tutorial tables
 * @returns {boolean} - true if the database creation completed successfully. Undefined otherwise.
 */
exports.create = (name, tables, autosave = false)  => {
    db.path = path.join(baseDir, `${name}.db.json`);
    const dbFilename = name + '.db.json';
    if (fs.existsSync(db.path)) {
        throw new Error(`Database ${name} already exists`);
    } else {
        db.autosave = autosave;
        verifyTables(tables, (res, data) => {
            if (!res) {
                throw new Error(`Type given, ${data}, does not conform to a supported type.`);
            } else {
                db.tables = data;
                for (let key in data) {
                    db.tables[key].count = 0;
                    db[key] = {};
                }
            }
        });
    }
    return true;
}

/**
 * Connect to an existing database. Function expects just the "name" of the database as an abbreviation of the 
 * filename name.db.json which this function will attempt to load.
 * @param {string} name - The name of the database to be loaded
 * @throws {Error} if the database given does not exist
 */
exports.connect = (name) => {
    db.path = path.join(baseDir, `${name}.db.json`)
    if (fs.existsSync(db.path)) {
        // TODO: should this next call be in a try/catch block in case parse error?
        db = JSON.parse(fs.readFileSync(db.path));
    } else {
        throw new Error(`Database ${name} does not exist`);
    }
}

/** checks if the value passed matches the type specified 
 * @param {string} - the type of the value to be tested: 'number', 'string', 'date', 'id ${table}', or 'array ${type}'
 * @param {value} - the value to be tested
 * @return {boolean} - True if the test passed, false if it failed
 * @throws {Error} - If the referenced table does not exist (when referencing by _id)
*/
const checkField = (type, value) => {
    const valid = {
        number: (val) => {
            return typeof val === 'number';
        },
        string: (val) => {
            return typeof val === 'string';
        },
        date: (val) => {
            return val instanceof Date;
        }
    }

    const s = type.split(' ');

    if (!type || !value) {
        return false; // we know by the point this function is called values must exist for both parameters
    }

    if (s.length === 1) {
        // We know it is a simple type
        if (valid[type] && valid[type](value)) return true;
        else return false;
    } else if (s[0] === 'array' && s[1] !== 'id') {
        // s[0] = 'array', s[1] = 'id', s[2] = 'type'
        const memberType = s[2];
        try {
            value.forEach( v => {
                if (!valid[memberType](v)) {
                    return false;
                }
            });
            return true;
        } catch (e) {
            return false;
        }        
    } else if (s[0] === 'array' && s[1] === 'id') {
        // s[0] = 'array', s[1] = 'id', s[2] = 'table'
        if (!db[s[2]]) {
            throw new Error(`Referenced table ${s[2]} does not exist.`);
        } else {
            try {
                value.forEach( v => {
                    if (!db[s[2]][value]) {
                        return false;
                    }
                });
                return true;
            } catch (e) {
                return false;
            }
            
        }
    } else if (s[0] === 'id') {
        if (!db[s[1]]) {
            throw new Error(`Referenced table ${s[2]} does not exist.`);
        } else {
            if (db[s[1]][value]) {
                return true;
            }
        }
    } else {
        return false;
    }
}

/**
 * Add a new entry to a table. The `_id` is created incrementally. (However, it could just as easily be a UUID by replacing `id` with a generated UUID)
 * @param {string} table - The name of the table to add to
 * @param {Object} entry - An object that conforms to the schema specified in the tables object
 * @param {function} cb - Callback function.
 * @returns {boolean} - The result of the insertion operation.
 */
exports.insert = (table, entry, cb = () => {}) => {
    const schema = db.tables[table];

    for (let k in entry) {
        if (!checkField(schema[k].type, entry[k])) {
            cb(false, {k: entry[k]});
            return false;
        } else {
            continue;
        }
    }

    const id = db.tables[table].count++;

    db[table][id] = entry;
    db[table][id]._id = id;

    if (db.autosave) {
        save();
    }

    cb(true, entry);
    return true;
}

/**
 * Set new value for a field. Overwrites the current value of the field.
 * @param {string} table - The table to be searched
 * @param {number} id - The id to be selected
 * @param {string} field - The field to be overwritten
 * @param {any} value - The value to be written. Must conform to table specification for type.
 * @returns {boolean} - The result of the set operation.
 */
exports.setFieldById = (table, id, field, value, cb = () => {}) => {
    if (checkField(db.tables[table][field].type, value)) {
        db[table][id][field] = value;
        cb(true, db[table][id]);
        if (db.autosave) {
            save();
        }
        return true;
    } else {
        cb(false, {field: value});
        return false;
    }
}

/**
 * Delete an entry by id.
 * @param {string} table - The table to be targeted
 * @param {number} id - The id of the entry to be deleted
 * @param {callback} cb - A callback function passed the deletion result and the id that was deleted
 */
exports.delete = (table, id, cb = () => {}) => {
    let result = delete db[table][parseInt(id)];
    if (result) {
        cb(true, id);
    } else {
        cb(false, id);
    }
    if (db.autosave) {
        save();
    }
}

/**
 * Fetch an entry by its id
 * @param {string} table - The table to be targeted
 * @param {number} id - The id of the entry to be retrieved
 * @param {function} cb - Callback function. First parameter is the result of the operation (true|false), second is
 * the entry that was retrieved
 * @returns {object} - The object which was found, or, if not found, undefined;
 */
exports.findById = (table, id, cb = () => {}) => {
    const found = db[table][parseInt(id)];
    if (found) {
        cb(true, found);
    } else {
        cb(false, id);
    }
    return found;
}

/**
 * Fetch the whole database object in memory
 * @param {function} cb - Callback function passed the full database object as a parameter
 * @returns {Object} - The full database object
 */
exports.getAll = (cb) => {
    if (typeof cb === 'function') {
        cb(db);
    }
    return db;
}

/*!
 * A private save function, so that we can not only use it internally, but also externally.
 * This is the function called each time there is an autosave.
 */
const save = () => {
    if (fs.existsSync(db.path)) {
        fs.copyFileSync(db.path, path.join(db.path + '.backup'));
    }
    return fs.writeFileSync(db.path, JSON.stringify(db), { encoding: 'utf8' });
}

/**
 * Write the database object in memory to file
 * @returns {boolean} - The result of the write operation
 */
exports.save = () => {
    return save();
}

/**
 * Find all items in a table with given field matching value.
 * @param {string} table - The name of the table to be searched
 * @param {field} field - The field to match
 * @param {value} value - The value to find in the field
 * @returns {object} - An array of objects matching the given parameters
 */
function findAll(table, field, value) {
    let res = []
    for (key in table) {
        if (table[key][field] === value) {
            res.push(table[key]);
        }
    }
    return res;
}

/**
 * Query a table using query object. Finds ALL matching entries
 * The currently supported query type is `fieldName: 'valueToMatch'`
 * Caveat: not yet tested with `date: [Date object]`
 * @param {string} tableName - The name of the table to be queried
 * @param {object} query - An object composed of the `field: value` pairs to be matched
 * @param {function} cb - A callback. If the query was successful (even if the results are empty), the first parameter will be true, if there was an error in the query it will be false.
 * the second parameter will be the found entries as an array (or undefined if none), or if there was an error a string describing the error.
 */
exports.find = (tableName, query, cb) => {
    if (query === {}) { cb(db[tableName]) }

    const fields = (() => {
        let f = [];
        for (let key in db.tables[tableName]) {
            f.push(key);
        }
        return f;
    })()

    for (let key in query) {
        if (fields.indexOf(key) > -1) {
            const results = findAll(db[tableName], key, query[key]);
            if (results.length > 0) {
                cb(true, results);
            } else {
                cb(true, undefined);
            }
        } else {
            cb(false, `Query table name does not exist, table: ${tableName}, field ${key}`);
        }
    }
}