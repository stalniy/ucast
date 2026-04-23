import type { MongoQuery } from '../src'
import { expect } from './specHelper'

declare const objectIdBrand: unique symbol
type ObjectId = { readonly [objectIdBrand]: 'ObjectId' }

interface User {
  readonly globalRoleIds: readonly ObjectId[]
}

describe('MongoQuery types', () => {
  it('accepts field operators with item values for readonly array fields', () => {
    const adminRole = { _id: {} as ObjectId }
    const query: MongoQuery<User> = {
      globalRoleIds: {
        $in: [adminRole._id],
        $nin: [adminRole._id],
        $all: [adminRole._id],
        $eq: [adminRole._id],
      },
    }

    expect(query.globalRoleIds).to.deep.equal({
      $in: [adminRole._id],
      $nin: [adminRole._id],
      $all: [adminRole._id],
      $eq: [adminRole._id],
    })
  })

  it('rejects field operators with unrelated item values for readonly array fields', () => {
    // @ts-expect-error string is not assignable to ObjectId
    const query: MongoQuery<User> = { globalRoleIds: { $in: ['admin'] } }

    expect(query).to.deep.equal({
      globalRoleIds: {
        $in: ['admin'],
      },
    })
  })
})
