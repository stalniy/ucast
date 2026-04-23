import type { MongoQuery } from '../src'
import { expect } from './specHelper'

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

  it('rejects nested array values for $in on readonly array fields', () => {
    const adminRole = { _id: {} as ObjectId }
    // @ts-expect-error $in accepts ObjectId values, not arrays of ObjectId values
    const query: MongoQuery<User> = { globalRoleIds: { $in: [[adminRole._id]] } }

    expect(query).to.deep.equal({
      globalRoleIds: {
        $in: [[adminRole._id]],
      },
    })
  })

  it('accepts equality operators with item and exact array values for array fields', () => {
    const query: MongoQuery<Product> = {
      tags: {
        $eq: 'sale',
        $ne: ['sale', 'featured'],
      },
      matrix: {
        $eq: [1, 2],
        $ne: [[1, 2], [3, 4]],
      },
    }

    expect(query).to.deep.equal({
      tags: {
        $eq: 'sale',
        $ne: ['sale', 'featured'],
      },
      matrix: {
        $eq: [1, 2],
        $ne: [[1, 2], [3, 4]],
      },
    })
  })

  it('accepts comparison operators with comparable item values for array fields', () => {
    const query: MongoQuery<Product> = {
      scores: {
        $lt: 10,
        $lte: 20,
        $gt: 0,
        $gte: 1,
      },
      tags: {
        $lt: 'm',
      },
    }

    expect(query).to.deep.equal({
      scores: {
        $lt: 10,
        $lte: 20,
        $gt: 0,
        $gte: 1,
      },
      tags: {
        $lt: 'm',
      },
    })
  })

  it('rejects comparison operators with non-item values for array fields', () => {
    // @ts-expect-error comparison operators use array item values
    const query: MongoQuery<Product> = { scores: { $lt: [10] } }

    expect(query).to.deep.equal({
      scores: {
        $lt: [10],
      },
    })
  })

  it('accepts membership operators with item values and string regex values', () => {
    const query: MongoQuery<Product> = {
      tags: {
        $in: ['sale', /^featured/],
        $nin: [/^archived/],
        $all: ['sale'],
      },
      scores: {
        $in: [1],
        $nin: [2],
        $all: [3],
      },
      matrix: {
        $in: [[1, 2]],
        $all: [[3, 4]],
      },
    }

    expect(query).to.deep.equal({
      tags: {
        $in: ['sale', /^featured/],
        $nin: [/^archived/],
        $all: ['sale'],
      },
      scores: {
        $in: [1],
        $nin: [2],
        $all: [3],
      },
      matrix: {
        $in: [[1, 2]],
        $all: [[3, 4]],
      },
    })
  })

  it('rejects regex values in membership operators for non-string fields', () => {
    // @ts-expect-error RegExp is only valid in $in for string fields
    const query: MongoQuery<Product> = { scores: { $in: [/^1/] } }

    expect(query).to.deep.equal({
      scores: {
        $in: [/^1/],
      },
    })
  })

  it('accepts array-only operators for array fields', () => {
    const query: MongoQuery<Product> = {
      scores: {
        $size: 2,
        $elemMatch: {
          $gte: 80,
          $lt: 85,
        },
      },
      results: {
        $elemMatch: {
          product: 'abc',
          score: {
            $gte: 8,
          },
        },
      },
    }

    expect(query).to.deep.equal({
      scores: {
        $size: 2,
        $elemMatch: {
          $gte: 80,
          $lt: 85,
        },
      },
      results: {
        $elemMatch: {
          product: 'abc',
          score: {
            $gte: 8,
          },
        },
      },
    })
  })

  it('rejects array-only operators for non-array fields', () => {
    // @ts-expect-error $size requires an array field
    const sizeQuery: MongoQuery<Product> = { quantity: { $size: 2 } }
    // @ts-expect-error $elemMatch requires an array field
    const elemMatchQuery: MongoQuery<Product> = { quantity: { $elemMatch: { $gt: 1 } } }

    expect([sizeQuery, elemMatchQuery]).to.deep.equal([
      { quantity: { $size: 2 } },
      { quantity: { $elemMatch: { $gt: 1 } } },
    ])
  })

  it('accepts regex operators for string fields', () => {
    const query: MongoQuery<Product> = {
      email: {
        $regex: /@example\.com$/,
        $options: 'im',
        $not: /@spam\.com$/,
      },
      tags: {
        $regex: '^sale',
        $options: 'su',
        $not: {
          $regex: '^archived',
          $options: 'i',
        },
      },
    }

    expect(query).to.deep.equal({
      email: {
        $regex: /@example\.com$/,
        $options: 'im',
        $not: /@spam\.com$/,
      },
      tags: {
        $regex: '^sale',
        $options: 'su',
        $not: {
          $regex: '^archived',
          $options: 'i',
        },
      },
    })
  })

  it('rejects regex operators for non-string fields and invalid options', () => {
    // @ts-expect-error $regex requires a string field
    const regexQuery: MongoQuery<Product> = { quantity: { $regex: /^1/ } }
    // @ts-expect-error $options does not support the global flag
    const optionsQuery: MongoQuery<Product> = { email: { $regex: /^a/, $options: 'g' } }
    // @ts-expect-error direct RegExp $not requires a string field
    const notQuery: MongoQuery<Product> = { quantity: { $not: /^1/ } }

    expect([regexQuery, optionsQuery, notQuery]).to.deep.equal([
      { quantity: { $regex: /^1/ } },
      { email: { $regex: /^a/, $options: 'g' } },
      { quantity: { $not: /^1/ } },
    ])
  })

  it('accepts modulo operators for numeric fields and numeric array fields', () => {
    const query: MongoQuery<Product> = {
      quantity: {
        $mod: [4, 0],
      },
      scores: {
        $mod: [3, 1],
      },
    }

    expect(query).to.deep.equal({
      quantity: {
        $mod: [4, 0],
      },
      scores: {
        $mod: [3, 1],
      },
    })
  })

  it('rejects modulo operators for non-numeric fields', () => {
    // @ts-expect-error $mod requires a numeric field or numeric array item
    const query: MongoQuery<Product> = { tags: { $mod: [2, 1] } }

    expect(query).to.deep.equal({
      tags: {
        $mod: [2, 1],
      },
    })
  })

  it('accepts existence checks and negated field operator expressions', () => {
    const query: MongoQuery<Product> = {
      quantity: {
        $exists: true,
        $not: {
          $gt: 10,
          $mod: [2, 0],
        },
      },
      tags: {
        $not: {
          $in: ['archived'],
        },
      },
    }

    expect(query).to.deep.equal({
      quantity: {
        $exists: true,
        $not: {
          $gt: 10,
          $mod: [2, 0],
        },
      },
      tags: {
        $not: {
          $in: ['archived'],
        },
      },
    })
  })

  it('rejects invalid existence checks and bare scalar negation', () => {
    // @ts-expect-error $exists requires a boolean value
    const existsQuery: MongoQuery<Product> = { quantity: { $exists: 'yes' } }
    // @ts-expect-error $not requires an operator expression or RegExp for string fields
    const notQuery: MongoQuery<Product> = { quantity: { $not: 10 } }

    expect([existsQuery, notQuery]).to.deep.equal([
      { quantity: { $exists: 'yes' } },
      { quantity: { $not: 10 } },
    ])
  })

  it('accepts top-level compound and document operators', () => {
    const query: MongoQuery<Product> = {
      $and: [{ quantity: { $gt: 0 } }],
      $or: [{ email: { $regex: /@/ } }],
      $nor: [{ available: false }],
      $where() {
        return this.quantity > 0
      },
    }

    expect(query.$and).to.deep.equal([{ quantity: { $gt: 0 } }])
    expect(query.$or).to.deep.equal([{ email: { $regex: /@/ } }])
    expect(query.$nor).to.deep.equal([{ available: false }])
    expect(query.$where && query.$where.call({
      tags: [],
      scores: [],
      matrix: [],
      results: [],
      email: 'user@example.com',
      quantity: 1,
      available: true,
    })).to.equal(true)
  })
})

declare const objectIdBrand: unique symbol
type ObjectId = { readonly [objectIdBrand]: 'ObjectId' }

interface User {
  readonly globalRoleIds: readonly ObjectId[]
}

interface Product {
  readonly tags: readonly string[]
  readonly scores: readonly number[]
  readonly matrix: readonly (readonly number[])[]
  readonly results: readonly {
    product: string
    score: number
  }[]
  readonly email: string
  readonly quantity: number
  readonly available: boolean
}
