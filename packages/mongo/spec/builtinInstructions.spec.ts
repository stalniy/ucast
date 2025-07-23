import { FieldCondition, CompoundCondition, DocumentCondition, ITSELF } from '@ucast/core'
import { MongoQueryParser, allParsingInstructions } from '../src'
import { expect } from './specHelper'

describe('Built-in instructions', () => {
  const parser = new MongoQueryParser(allParsingInstructions)

  describe('$and', () => {
    it('throws if receives non-array or empty array', () => {
      expect(() => parser.parse({ $and: [] })).to.throw(/at least one element/)
      expect(() => parser.parse<any>({ $and: 1 })).to.throw(/expects value to be an array/)
    })

    it('is parsed as `CompoundCondition`', () => {
      const ast = parser.parse({ $and: [{ a: 1 }, { b: 2 }] }) as CompoundCondition

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(ast.operator).to.equal('and')
      expect(ast.value.every(c => c instanceof FieldCondition)).to.be.true
    })

    it('returns child condition if it is only 1', () => {
      const ast = parser.parse({ $and: [{ field: 5 }] })

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('eq')
    })

    it('merges child conditions of with the same operator', () => {
      const query = {
        a: 1,
        $and: [
          { b: 2 },
          { $and: [{ c: 3 }, { d: 4 }] }],
      }
      const ast = parser.parse(query) as CompoundCondition
      const conditions = ast.value as FieldCondition[]

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(conditions).to.have.length(4)
      expect(conditions.every(c => c instanceof FieldCondition)).to.be.true
      expect(conditions).to.deep.equal([
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2 },
        { field: 'c', operator: 'eq', value: 3 },
        { field: 'd', operator: 'eq', value: 4 },
      ])
    })
  })

  describe('$or', () => {
    it('is parsed the same way as "$and"', () => {
      expect(allParsingInstructions.$or).to.equal(allParsingInstructions.$and)
    })
  })

  describe('$nor', () => {
    it('throws if receives non-array or empty array', () => {
      expect(() => parser.parse({ $nor: [] })).to.throw(/at least one element/)
      expect(() => parser.parse<any>({ $nor: 1 })).to.throw(/expects value to be an array/)
    })

    it('is parsed as `CompoundCondition`', () => {
      const ast = parser.parse({ $nor: [{ a: 1 }] }) as CompoundCondition

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(ast.operator).to.equal('nor')
      expect(ast.value[0]).to.be.instanceOf(FieldCondition)
    })
  })

  describe('$not', () => {
    it('is parsed as `CompoundCondition` of `FieldCondition` when `RegExp` is passed', () => {
      const ast = parser.parse({ field: { $not: /test/i } }) as CompoundCondition
      const conditions = ast.value as FieldCondition[]

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(ast.operator).to.equal('not')
      expect(conditions).to.have.length(1)
      expect(conditions[0]).to.be.instanceOf(FieldCondition)
      expect(conditions[0].operator).to.equal('regex')
    })

    it('is parsed as `CompoundCondition` of `FieldCondition`s when object literal is passed', () => {
      const ast = parser.parse({ field: { $not: { $gt: 1, $lt: 2 } } }) as CompoundCondition
      const conditions = ast.value as FieldCondition[]
      const nestedConditions = conditions[0].value as FieldCondition[]

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(ast.operator).to.equal('not')
      expect(conditions).to.have.length(1)
      expect(conditions[0]).to.be.instanceOf(CompoundCondition)
      expect(conditions[0].operator).to.equal('and')
      expect(nestedConditions).to.deep.equal([
        { operator: 'gt', field: 'field', value: 1 },
        { operator: 'lt', field: 'field', value: 2 }
      ])
    })

    it('throws if value is undefined, not a RegExp or not a POJO', () => {
      expect(() => {
        parser.parse<any>({ field: { $not: 1 } })
      }).to.throw(/expects to receive either regular expression or object of field operators/)
      expect(() => {
        parser.parse<any>({ field: { $not: null } })
      }).to.throw(/expects to receive either regular expression or object of field operators/)
      expect(() => {
        parser.parse<any>({ field: { $not: [] } })
      }).to.throw(/expects to receive either regular expression or object of field operators/)
    })
  })

  describe('$elemMatch', () => {
    it('is parsed as `FieldCondition<CompoundCondition>` when nested query is passed', () => {
      const ast = parser.parse({
        field: {
          $elemMatch: {
            a: 1,
            b: 2
          }
        }
      }) as FieldCondition<CompoundCondition>

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('elemMatch')
      expect(ast.value).to.be.instanceOf(CompoundCondition)
      expect(ast.value.operator).to.equal('and')
      expect(ast.value.value).to.deep.equal([
        { field: 'a', operator: 'eq', value: 1 },
        { field: 'b', operator: 'eq', value: 2 },
      ])
    })

    it('is parsed as `FieldCondition<CompoundCondition>` when field operators is passed (every child condition points to ITSELF)', () => {
      const ast = parser.parse({
        field: {
          $elemMatch: {
            $lt: 1,
            $gt: 2
          }
        }
      }) as FieldCondition<CompoundCondition>

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('elemMatch')
      expect(ast.value).to.be.instanceOf(CompoundCondition)
      expect(ast.value.operator).to.equal('and')
      expect(ast.value.value).to.deep.equal([
        { field: ITSELF, operator: 'lt', value: 1 },
        { field: ITSELF, operator: 'gt', value: 2 },
      ])
    })

    it('throws if passed value is not an object', () => {
      expect(() => {
        parser.parse({ a: { $elemMatch: 1 } })
      }).to.throw(/expects to receive an object/)
      expect(() => {
        parser.parse({ a: { $elemMatch: [] } })
      }).to.throw(/expects to receive an object/)
      expect(() => {
        parser.parse({ a: { $elemMatch: null } })
      }).to.throw(/expects to receive an object/)
    })
  })

  describe('$size', () => {
    it('is parsed as `FieldCondition<number>`', () => {
      const ast = parser.parse({ a: { $size: 10 } }) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('size')
      expect(ast.value).to.equal(10)
      expect(ast.field).to.equal('a')
    })

    it('throws if passed value is not a number', () => {
      expect(() => {
        parser.parse({ a: { $size: 'test' } })
      }).to.throw(/expects value to be a "number"/)
      expect(() => {
        parser.parse({ a: { $size: null } })
      }).to.throw(/expects value to be a "number"/)
      expect(() => {
        parser.parse({ a: { $size: [] } })
      }).to.throw(/expects value to be a "number"/)
    })
  })

  describe('$in', () => {
    it('is parsed as `FieldCondition<unknown[]>`', () => {
      const query = { a: { $in: [1, 2, 3] } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('in')
      expect(ast.value).to.equal(query.a.$in)
      expect(ast.field).to.equal('a')
    })

    it('throws if value is not an array', () => {
      expect(() => parser.parse({ a: { $in: {} } })).to.throw(/expects value to be an array/)
      expect(() => parser.parse({ a: { $in: 1 } })).to.throw(/expects value to be an array/)
      expect(() => parser.parse({ a: { $in: null } })).to.throw(/expects value to be an array/)
    })
  })

  describe('$nin', () => {
    it('is parsed the same way as "$in"', () => {
      expect(allParsingInstructions.$nin).to.equal(allParsingInstructions.$in)
    })
  })

  describe('$mod', () => {
    it('is parsed as `FieldCondition<[number, number]>`', () => {
      const query = { a: { $mod: [2, 1] } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('mod')
      expect(ast.value).to.equal(query.a.$mod)
      expect(ast.field).to.equal('a')
    })

    it('throws if passed not an array or array length does not equal 2', () => {
      expect(() => {
        parser.parse({ a: { $mod: [] } })
      }).to.throw(/expects an array with 2 numeric elements/)
      expect(() => {
        parser.parse({ a: { $mod: [1] } })
      }).to.throw(/expects an array with 2 numeric elements/)
      expect(() => {
        parser.parse<any>({ a: { $mod: null } })
      }).to.throw(/expects an array with 2 numeric elements/)
      expect(() => {
        parser.parse<any>({ a: { $mod: 1 } })
      }).to.throw(/expects an array with 2 numeric elements/)
    })
  })

  describe('$exists', () => {
    it('is parsed as `FieldCondition<boolean>`', () => {
      const query = { a: { $exists: true } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('exists')
      expect(ast.value).to.equal(query.a.$exists)
      expect(ast.field).to.equal('a')
    })

    it('throws if passed not a boolean', () => {
      expect(() => {
        parser.parse({ a: { $exists: [] } })
      }).to.throw(/expects value to be a "boolean"/)
      expect(() => {
        parser.parse({ a: { $exists: null } })
      }).to.throw(/expects value to be a "boolean"/)
      expect(() => {
        parser.parse({ a: { $exists: {} } })
      }).to.throw(/expects value to be a "boolean"/)
    })
  })

  describe('$gt', () => {
    it('is parsed as `FieldCondition<Comparable>`', () => {
      const query = { a: { $gt: 5 } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('gt')
      expect(ast.value).to.equal(query.a.$gt)
      expect(ast.field).to.equal('a')
    })

    it('throws if passed not a comparable value (string, number, Date)', () => {
      expect(() => parser.parse({ a: { $gt: [] } })).to.throw(/expects value to be comparable/)
      expect(() => parser.parse({ a: { $gt: null } })).to.throw(/expects value to be comparable/)
      expect(() => parser.parse({ a: { $gt: {} } })).to.throw(/expects value to be comparable/)
    })
  })

  describe('$gte', () => {
    it('is parsed the same way as "$gt"', () => {
      expect(allParsingInstructions.$gte).to.equal(allParsingInstructions.$gt)
    })
  })

  describe('$lt', () => {
    it('is parsed the same way as "$gt"', () => {
      expect(allParsingInstructions.$lt).to.equal(allParsingInstructions.$gt)
    })
  })

  describe('$lte', () => {
    it('is parsed the same way as "$gt"', () => {
      expect(allParsingInstructions.$lte).to.equal(allParsingInstructions.$gt)
    })
  })

  describe('$eq', () => {
    it('is parsed as `FieldCondition`', () => {
      const query = { a: { $eq: {} } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('eq')
      expect(ast.value).to.equal(query.a.$eq)
      expect(ast.field).to.equal('a')
    })

    it('parsed nested condition as FieldCondition', () => {
      const query = { foo: { bar: { $eq: 'boz' } } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('eq')
      expect(ast.value).to.equal(query.foo.bar.$eq)
      expect(ast.field).to.equal('boz')
    })
  })

  describe('$ne', () => {
    it('is parsed the same way as "$eq"', () => {
      expect(allParsingInstructions.$ne).to.equal(allParsingInstructions.$eq)
    })
  })

  describe('$regex', () => {
    it('is parsed as `FieldCondition<RegExp>` when `RegExp` is passed', () => {
      const query = { a: { $regex: /test/i } }
      const ast = parser.parse(query) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('regex')
      expect(ast.value).to.equal(query.a.$regex)
      expect(ast.field).to.equal('a')
    })

    it('is parsed as `FieldCondition<RegExp>` when regex is passed as string', () => {
      const query = { a: { $regex: 'test' } }
      const ast = parser.parse(query) as FieldCondition<RegExp>

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.value.toString()).to.equal(`/${query.a.$regex}/`)
    })

    it('is parsed as `FieldCondition<RegExp>` with modifier from `$options` operator', () => {
      const query = { a: { $regex: 'test', $options: 'i' } }
      const ast = parser.parse(query) as FieldCondition<RegExp>

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.value.toString()).to.equal(`/${query.a.$regex}/${query.a.$options}`)
    })

    it('throws if passed not a string or RegExp', () => {
      expect(() => {
        parser.parse({ a: { $regex: [] } })
      }).to.throw(/expects value to be a regular expression or a string/)
      expect(() => {
        parser.parse({ a: { $regex: null } })
      }).to.throw(/expects value to be a regular expression or a string/)
      expect(() => {
        parser.parse({ a: { $regex: {} } })
      }).to.throw(/expects value to be a regular expression or a string/)
    })
  })

  describe('$where', () => {
    it('is parsed as `DocumentCondition<Function>`', () => {
      const query = { $where: () => true }
      const ast = parser.parse(query) as DocumentCondition<Function>

      expect(ast).to.be.instanceOf(DocumentCondition)
      expect(ast.operator).to.equal('where')
      expect(ast.value).to.equal(query.$where)
    })

    it('throws if passed not a function', () => {
      expect(() => parser.parse<any>({ $where: null })).to.throw(/expects value to be a "function"/)
      expect(() => parser.parse<any>({ $where: 1 })).to.throw(/expects value to be a "function"/)
      expect(() => parser.parse<any>({ $where: [] })).to.throw(/expects value to be a "function"/)
      expect(() => parser.parse<any>({ $where: {} })).to.throw(/expects value to be a "function"/)
    })
  })
})
