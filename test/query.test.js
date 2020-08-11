const { TestScheduler } = require('jest')
const Query = require('../src/query')

describe('Query creation with new', () => {
    test('Should be instance of Query', () => {
        expect(new Query('a', 'b', 'c', 'd') instanceof Query).toBeTruthy()
    })

    test('Undefined table param should fail', () => {
        expect(() => {
            new Query(null, 'b', 'c', 'd')
        }).toThrow()
    })
})
