/**
 * Create a new query object.
 * This is a convenience function that creates a new object with one key.
 * You could create the objects manually, it's just cumbersome and bulky
 * @param {string} field The field to search
 * @param {string} func The search function to use
 * @param {*} val The value to use in the search function
 */
function Query (field, func, val) {
    const ret = {}
    ret[field] = {}
    ret[field][func] = val
    console.log(ret)
    return ret
}

module.exports = Query
