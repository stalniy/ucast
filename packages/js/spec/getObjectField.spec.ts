import { ITSELF } from '@ucast/core'
import { expect } from './specHelper'
import { getObjectField } from '../src'

describe('getObjectField', () => {
  it('returns passed value if field equals to ITSELF constant', () => {
    const object = {}
    expect(getObjectField(object, ITSELF)).to.equal(object)
  })

  it('returns specified object field value', () => {
    const object = { age: 1 }
    expect(getObjectField(object, 'age')).to.equal(object.age)
  })

  it('returns specified array item field values', () => {
    const object = [{ age: 1 }, { age: 2 }]
    expect(getObjectField(object, 'age')).to.deep.equal([1, 2])
  })

  it('returns nested property value specified by dot notation (e.g., "address.street")', () => {
    const object = { address: { street: 'test' } }
    expect(getObjectField(object, 'address.street')).to.equal(object.address.street)
  })

  it('returns nested property values from array', () => {
    const object = { items: [{ price: 12 }, { price: 14 }] }
    expect(getObjectField(object, 'items.price')).to.deep.equal([12, 14])
  })

  it('returns property values from nested array as flat array', () => {
    const object = { items: [{ specs: [{ price: 12 }] }, { specs: [{ price: 14 }] }] }
    expect(getObjectField(object, 'items.specs.price')).to.deep.equal([12, 14])
  })

  it('returns array item when specified number as the last path field', () => {
    const object = { items: [{ price: 12 }, { price: 14 }] }
    expect(getObjectField(object, 'items.0')).to.deep.equal({ price: 12 })
  })

  it('throws exception when trying to get property of not an object', () => {
    expect(() => getObjectField(null, 'item')).to.throw(/Unable to get field/)
    expect(() => getObjectField(undefined, 'item')).to.throw(/Unable to get field/)
  })

  it('allows to pass custom "get" function', () => {
    const state: Record<string, number> = { value: 1, age: 10 }
    const object = { get: (field: string) => state[field] }
    const get = (item: typeof object, field: string) => item.get(field)

    expect(getObjectField(object, 'value', get)).to.equal(state.value)
  })

  it('returns undefined when trying to traverse path beyond a primitive value', () => {
    const object = { foo: 22 }
    expect(getObjectField(object, 'foo.bar')).to.be.undefined
  })
})
