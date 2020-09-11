const fs = require('fs')
const path = require('path')
const _static = {}

// Join functions for Query result arrays
_static.AND = (arr) => {
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
    console.log(common)
    return common
}

_static.OR = (arr) => {
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

_static.checkType = {
    number: (val) => { return typeof val === 'number' },
    string: (val) => { return typeof val === 'string' },
    date: (val) => { return val instanceof Date }
}

_static.convertEntryArrayToObject = (tableObject, ids) => {
    const ret = {}
    for (var i in ids) {
        ret[ids[i]] = tableObject[ids[i]]
    }
    return Object.size(ret) === 0 ? null : ret
}

_static.duplicateFileIfExists = (dbPath, unique) => {
    const p = path.parse(dbPath)
    if (fs.existsSync(dbPath)) {
        const backupPath = unique ?
            path.join(p.dir, (new Date().toISOString()) + (p.name + p.ext)) :
            path.join(dbPath, '.old')
        fs.copyFileSync(dbPath, backupPath)
    }
}

_static.getUUID = () => {
    var RFC4122_TEMPLATE = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    var replacePlaceholders = function (placeholder) {
        var random = Math.round(Math.random() * 15)
        var value = placeholder === 'x' ? random : (random & 0x3 | 0x8)
        return value.toString(16)
    }
    return RFC4122_TEMPLATE.replace(/[xy]/g, replacePlaceholders)
}

module.exports = _static
