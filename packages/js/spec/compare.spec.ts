import { compare } from '../src'
import { expect } from './specHelper'

describe(compare.name, () => {
  it('returns null for incompatible types in either direction', () => {
    expect(compare<unknown>('0', 0)).to.be.null
    expect(compare<unknown>(0, '0')).to.be.null
    expect(compare<unknown>(false, 0)).to.be.null
    expect(compare<unknown>(0, false)).to.be.null
    expect(compare<unknown>(null, 0)).to.be.null
    expect(compare<unknown>(0, null)).to.be.null
    expect(compare<unknown>(undefined, 0)).to.be.null
    expect(compare<unknown>(0, undefined)).to.be.null
    expect(compare<unknown>(new Date(0), 0)).to.be.null
    expect(compare<unknown>(0, new Date(0))).to.be.null
    expect(compare<unknown>(1n, 1)).to.be.null
    expect(compare<unknown>(1, 1n)).to.be.null
    expect(compare<unknown>(new Number(0), 0)).to.be.null
    expect(compare<unknown>(0, new Number(0))).to.be.null
  })

  it('orders compatible values and preserves equality', () => {
    expect(compare(1, 2)).to.equal(-1)
    expect(compare(2, 1)).to.equal(1)
    expect(compare(1, 1)).to.equal(0)
    expect(compare('a', 'b')).to.equal(-1)
    expect(compare(1n, 2n)).to.equal(-1)
    expect(compare(new Date(1000), new Date(2000))).to.equal(-1)
    expect(compare(null, null)).to.equal(0)
    expect(compare(undefined, undefined)).to.equal(0)
    const object = {}
    expect(compare(object, object)).to.equal(0)
  })
})
