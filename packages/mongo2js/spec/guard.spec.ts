import { guard } from '../src'
import { expect } from './specHelper'

describe('guard', () => {
  it('creates a mongo query matcher', () => {
    const test = guard({ a: 1 })
    expect(test({ a: 2 })).to.be.false
  })

  it('accepts generic parameter type', () => {
    type Person = { firstName: string }
    const test = guard<Person>({ firstName: { $eq: 'test' } })

    expect(test({ firstName: 'test' })).to.be.true
  })

  it('compares Dates and numeric timestamps', () => {
    const now = new Date(1000)

    for (const operator of ['$lt', '$lte', '$gt', '$gte']) {
      const offset = operator === '$lt' || operator === '$lte' ? -10 : 10
      const test = guard({ createdAt: { [operator]: now } })

      expect(test({ createdAt: new Date(now.getTime() + offset) })).to.be.true
      expect(test({ createdAt: new Date(now.getTime() - offset) })).to.be.false
      expect(test({ createdAt: new Date(now.getTime()) }))
        .to.equal(operator === '$lte' || operator === '$gte')
      expect(test({ createdAt: now.getTime() + offset })).to.be.true
      expect(test({ createdAt: now.getTime() - offset })).to.be.false
      expect(test({ createdAt: String(now.getTime() + offset) })).to.be.false
      expect(test({ createdAt: now.getTime() })).to.equal(operator === '$lte' || operator === '$gte')

      const numericTest = guard({ createdAt: { [operator]: now.getTime() } })
      expect(numericTest({ createdAt: new Date(now.getTime() + offset) })).to.be.true
    }
  })

  it('can check equality of wrapper objects that have `toJSON` method (e.g., `ObjectId`)', () => {
    const id = <T>(value: T) => ({ value, toJSON: () => value })
    const test = guard({ id: id(1) })

    expect(test({ id: 1 })).to.be.true
    expect(test({ id: id(1) })).to.be.true
    expect(test({ id: id(2) })).to.be.false
  })

  it('supports bigint', () => {
    const test = guard({ id: { $eq: 1n } })

    expect(test({ id: 1n })).to.be.true
    expect(test({ id: 1 })).to.be.false
  })

  it('processes primitive values without attempting to call its `toJSON` method', () => {
    const test = guard({
      number: 42,
      bigint: BigInt(42),
      string: 'test',
      boolean: true,
      null: null,
      undefined
    })

    const restoreOriginalToJSON = [
      overwriteProperty(Number.prototype, 'toJSON', () => 'number'),
      overwriteProperty(BigInt.prototype, 'toJSON', () => 'bigint'),
      overwriteProperty(String.prototype, 'toJSON', () => 'string'),
      overwriteProperty(Boolean.prototype, 'toJSON', () => 'boolean'),
    ]

    try {
      expect(test({
        number: 42,
        bigint: BigInt(42),
        string: 'test',
        boolean: true,
        null: null,
        undefined
      })).to.be.true
      expect(test({
        number: 43,
        string: 'test',
        boolean: true,
        null: null,
        undefined
      })).to.be.false
    } finally {
      restoreOriginalToJSON.forEach(restore => restore())
    }
  })

  it('compares objects by value', () => {
    const value = { b: 1 }
    const test = guard({ prop: value })

    expect(test({ prop: value })).to.be.true
    expect(test({ prop: { b: 1 } })).to.be.false
  })

  it('returns false when trying to match nested field against primitive value', () => {
    expect(guard({ 'foo': 22 })({ foo: 22 })).to.be.true // OK
    expect(guard({ 'foo.bar': 22 })({ baz: 22 })).to.be.false // OK
    expect(guard({ 'foo.bar': 22 })({ foo: { bar: 22 } })).to.be.true // OK
    expect(guard({ 'foo.bar': 22 })({ foo: { baz: 22 } })).to.be.false // OK
    expect(guard({ 'foo.bar': 22 })({ foo: 23 })).to.be.false // OK
    expect(guard({ 'foo.bar': 22 })({ foo: 22 })).to.be.false // BUG FIX
  })

  function overwriteProperty(obj: any, prop: string, value: unknown) {
    const original = obj[prop]
    obj[prop] = value
    return () => { obj[prop] = original }
  }
})
