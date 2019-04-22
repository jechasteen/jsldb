/**
 * jsldb module
 * @module jsldb
 */

const fs = require('fs');
const path = require('path');
const baseDir = path.dirname(require.main.filename);

// Emit a signal upon error
const EventEmitter = require('events');
const emit = new EventEmitter().emit;
const DBERROR = 'DBERROR';

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
 * @param {object} tables - A schema object used to create and verify db entries. This object is passed to create()
 * @param {function} cb - Function has the arguments (result: boolean, [failedType: string || passedTable: object])
 */
const verifyTables = (unverifiedTables, cb) => {
    const tables = [];

    for (let key in unverifiedTables) {
        tables.push(key);
    }
    //console.log(unverifiedTables);

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
                if (f !== 'array') {
                    cb(false, f.type);
                } else if (s[0] === 'id') {
                    if (tables.indexOf(s[1]) < 0) {
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
 * @tutorial tables
 */
exports.create = (name, tables, autosave = false)  => {
    db.path = path.join(baseDir, `${name}.db.json`);
    const dbFilename = name + '.db.json';
    if (fs.existsSync(db.path)) {
        emit(DBERROR, new Error(`Database ${name} already exists`));        
    } else {
        db.autosave = autosave;
        verifyTables(tables, (res, data) => {
            if (!res) {
                emit(DBERROR, 'Type given, ${data}, does not conform to a supported type.');
            } else {
                db.tables = data;
                for (let key in data) {
                    db.tables[key].count = 0;
                    db[key] = {};
                }
            }
        });
    }
}

/**
 * Connect to an existing database. Function expects just the "name" of the database as an abbreviation of the 
 * filename name.db.json which this function will attempt to load.
 * @param {string} name - The name of the database to be loaded
 * @throws {DBERROR} If the database given does not exist
 */
exports.connect = (name) => {
    db.path = path.join(baseDir, `${name}.db.json`)
    if (fs.existsSync(db.path)) {
        // TODO: should this next call be in a try/catch block in case parse error?
        db = JSON.parse(fs.readFileSync(db.path));
    } else {
        emit(DBERROR, new Error(`Database ${name} does not exist`));
    }
}

/** checks if the value passed matches the type specified 
 * @param {string} - the type of the value to be tested: 'number', 'string', 'date', 'id ${table}', or 'array ${type}'
 * @param {value} - the value to be tested
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
            emit(DBERROR, new Error(`Referenced table ${s[2]} does not exist.`))
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
        // t[0] = 'id', t[1] = 'table'
        if (!db[s[1]]) {
            emit(DBERROR, new Error(`Referenced table ${s[2]} does not exist.`))
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
 * Add a new entry to a table
 * @param {string} table - The name of the table to add to
 * @param {Object} entry - An object that conforms to the schema specified in the tables object
 * @param {function} cb - Callback function.
 */
exports.insert = (table, entry, cb = () => {}) => {
    const schema = db.tables[table];

    for (let k in entry) {
        if (!checkField(schema[k].type, entry[k])) {
            cb(false, {k: entry[k]});
        } else {
            continue;
        }
    }

    db[table][db.tables[table].count++] = entry;
    if (db.autosave) {
        this.save();
    }
    cb(true, entry);
}

/**
 * Set new value for a field. Overwrites the current value of the field.
 * @param {string} table - The table to be searched
 * @param {number} id - The id to be selected
 * @param {string} field - The field to be overwritten
 * @param {any} value - The value to be written. Must conform to table specification for type.
 */
exports.setFieldById = (table, id, field, value, cb = () => {}) => {
    if (checkField(db.tables[table][field].type, value)) {
        db[table][id][field] = value;
        cb(true, db[table][id]);
        if (db.autosave) {
            this.save();
        }
    } else {
        cb(false, {field: value});
    }
}

/**
 * Delete an entry by id
 * @param {string} table - The table to be targeted
 * @param {number} id - The id of the entry to be deleted
 * @returns {boolean} - The result of the deletion
 */
exports.delete = (table, id, cb = () => {}) => {
    let result = delete db[table][parseInt(id)];
    console.log('result: ', result);
    if (result) {
        cb(true, id);
    } else {
        cb(false, id);
    }
    if (db.autosave) {
        this.save();
    }
}

/**
 * Fetch an entry
 * @param {string} table - The table to be targeted
 * @param {number} id - The id of the entry to be retrieved
 * @param {function} cb - Callback function. First parameter is the result of the operation (true|false), second is
 * the entry that was retrieved
 */
exports.getById = (table, id, cb) => {
    if (db[table][parseInt(id)]) {
        cb(true, db[table][parseInt(id)]);
    } else {
        cb(false, id);
    }
}

/**
 * Fetch the whole database object in memory
 * @returns {Object}
 */
exports.db = () => {
    return db;
}

/**
 * Write the database object in memory to file
 * @returns {boolean} - The result of the write operation
 */
exports.save = () => {
    if (fs.existsSync(db.path)) {
        fs.copyFileSync(db.path, path.join(db.path + '.backup'));
    }
    return fs.writeFileSync(db.path, JSON.stringify(db), { encoding: 'utf8' });
}
