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
