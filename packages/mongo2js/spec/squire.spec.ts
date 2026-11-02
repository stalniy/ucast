import { squire } from '../src'
import { expect } from './specHelper'

describe('squire', () => {
  it('creates a mongo query matcher for primitives', () => {
    const test = squire({ $lt: 1 })

    expect(test(2)).to.be.false
    expect(test(0)).to.be.true
  })

  it('accepts generic parameter type', () => {
    const test = squire<string>({ $eq: 'test' })

    expect(test('test')).to.be.true
    expect(test('test2')).to.be.false
  })

  it('compares Dates and numeric timestamps', () => {
    const now = new Date(1000)

    for (const operator of ['$lt', '$lte', '$gt', '$gte']) {
      const offset = operator === '$lt' || operator === '$lte' ? -10 : 10
      const test = squire({ [operator]: now })

      expect(test(new Date(now.getTime() + offset))).to.be.true
      expect(test(new Date(now.getTime() - offset))).to.be.false
      expect(test(new Date(now.getTime()))).to.equal(operator === '$lte' || operator === '$gte')
      expect(test(now.getTime() + offset)).to.be.true
      expect(test(now.getTime() - offset)).to.be.false
      expect(test(String(now.getTime() + offset))).to.be.false
      expect(test(now.getTime())).to.equal(operator === '$lte' || operator === '$gte')

      const numericTest = squire({ [operator]: now.getTime() })
      expect(numericTest(new Date(now.getTime() + offset))).to.be.true
    }
  })

  it('can interpret `$and` operator for primitives', () => {
    const test = squire({ $and: [{ $gt: 5 }, { $lt: 10 }] })

    expect(test(6)).to.be.true
    expect(test(3)).to.be.false
  })

  it('can interpret `$or` operator for primitives', () => {
    const test = squire({ $or: [{ $gt: 6 }, { $eq: 6 }] })

    expect(test(6)).to.be.true
    expect(test(7)).to.be.true
    expect(test(3)).to.be.false
  })

  it('can interpret `$nor` operator for primitives', () => {
    const test = squire({ $nor: [{ $gt: 6 }, { $eq: 6 }] })

    expect(test(6)).to.be.false
    expect(test(7)).to.be.false
    expect(test(3)).to.be.true
  })
})
