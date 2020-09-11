const _static = require('../src/static')

const arr1 = [0, 1, 2, 3, 4]
const arr2 = [2, 4, 6]

describe('AND', () => {
    test('Should only include items in both arrays', () => {
        expect(_static.AND([arr1, arr2])).toStrictEqual([2, 4])
    })
})

describe('OR', () => {
    test('Should include all items from both arrays ', () => {
        expect(_static.OR([arr1, arr2])).toStrictEqual([0, 1, 2, 3, 4, 6])
    })
})