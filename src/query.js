/**
 * Create a new query object.
 * This is a convenience function that creates a new object with one key.
 * You could create the objects manually, it's just cumbersome and bulky
 * @param {string} field The field to search
 * @param {string} fn The search function to use
 * @param {*} val The value to use in the search function
 */
function Query (table, field, fn, val) {
    this.table = table
    this.field = field
    this.fn = fn
    this.val = val
}

module.exports = Query
