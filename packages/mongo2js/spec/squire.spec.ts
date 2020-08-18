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

  it('can compare Dates', () => {
    const now = new Date()
    const test = squire({ $gt: now })

    expect(test(new Date(now.getTime() + 10))).to.be.true
    expect(test(now.getTime() + 10)).to.be.true
    expect(test(now.getTime() - 10)).to.be.false
  })

  it('throws exception when field or top-level operator is specified', () => {
    expect(() => squire({ $and: [] } as any)).to.throw(Error)
    expect(() => squire({ field: 5 } as any)).to.throw(Error)
  })
})
