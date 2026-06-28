import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import { expect } from './specHelper.ts'
import {
  createSqlInterpreter,
  eq,
  ne,
  lte,
  lt,
  gte,
  gt,
  exists,
  within,
  nin,
  and,
  not,
  or,
  nor,
  mod,
  regex,
  pg,
  oracle,
  mysql,
  mssql,
  type SqlQueryOptions,
  someRelation,
  noneRelation,
  everyRelation,
} from '../src/index.ts'

const options: SqlQueryOptions = {
  ...pg,
}

describe('Condition Interpreter', () => {
  describe('primitive operators', () => {
    const interpret = createSqlInterpreter({ eq, ne, lt, lte, gt, gte, mod })

    it('generates query with `=` operator for "eq"', () => {
      const condition = new Field('eq', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} = $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<>` operator for "ne"', () => {
      const condition = new Field('ne', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} <> $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<` operator for "lt"', () => {
      const condition = new Field('lt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} < $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<=` operator for "lte"', () => {
      const condition = new Field('lte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} <= $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>` operator for "gt"', () => {
      const condition = new Field('gt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} > $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>=` operator for "gte"', () => {
      const condition = new Field('gte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} >= $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates call to `MOD` function for "mod"', () => {
      const condition = new Field('mod', 'qty', [4, 0])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('mod("qty", $1) = $2')
      expect(params).to.deep.equal([4, 0])
    })
  })

  describe('exists', () => {
    const interpret = createSqlInterpreter({ exists })

    it('generates query with `is not null` operator when value equals `true`', () => {
      const condition = new Field('exists', 'address', true)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} is not null`)
      expect(params).to.be.empty
    })

    it('generates query with `is null` operator when value equals `false`', () => {
      const condition = new Field('exists', 'address', false)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} is null`)
      expect(params).to.be.empty
    })
  })

  describe('in (within, nin)', () => {
    const interpret = createSqlInterpreter({ within, nin, and, eq })

    it('generates a separate placeholder for every element in the array', () => {
      const condition = new Field('within', 'age', [1, 2])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} in($1, $2)`)
      expect(params).to.deep.equal(condition.value)
    })

    it('correctly generates placeholders when combined with other operators', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'John'),
        new Field('within', 'age', [1, 2])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("name" = $1 and "age" in($2, $3))')
      expect(params).to.deep.equal(['John', 1, 2])
    })

    it('generates `not in` operator for "nin', () => {
      const condition = new Field('nin', 'age', [1, 2])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} not in($1, $2)`)
      expect(params).to.deep.equal(condition.value)
    })
  })

  describe('compound operators', () => {
    const interpret = createSqlInterpreter({ or, nor, not, and, eq, lt, gt })

    it('generates query with inverted condition for "not"', () => {
      const condition = new CompoundCondition('not', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 12),
          new Field('eq', 'age', 13),
        ])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('not (("age" = $1 or "age" = $2))')
      expect([12, 13]).to.deep.equal(params)
    })

    it('generates query combined by logical `and` for "and"', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("age" = $1 and "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('generates query combined by logical `or` for "or"', () => {
      const condition = new CompoundCondition('or', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("age" = $1 or "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('generates inverted query combined by logical `or` for "nor"', () => {
      const condition = new CompoundCondition('nor', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('not ("age" = $1 or "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('properly adds brackets for complex compound condition', () => {
      const condition = new CompoundCondition('or', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 1),
          new Field('eq', 'age', 2),
        ]),
        new CompoundCondition('and', [
          new Field('gt', 'qty', 1),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('nor', [
          new Field('gt', 'qty', 10),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('not', [new CompoundCondition('and', [
          new Field('eq', 'active', false),
          new Field('gt', 'age', 18)
        ])])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal([
        '(("age" = $1 or "age" = $2)',
        'or ("qty" > $3 and "qty" < $4)',
        'or not ("qty" > $5 or "qty" < $6)',
        'or not (("active" = $7 and "age" > $8)))',
      ].join(' '))
      expect(params).to.deep.equal([1, 2, 1, 20, 10, 20, false, 18])
    })
  })

  describe('regex', () => {
    const interpret = createSqlInterpreter({ regex })

    it('generates posix operator for PostgreSQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...pg })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates posix operator for Oracle', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...oracle })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates call to `REGEXP` function for MySQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...mysql })

      expect(sql).to.equal('`email` regexp ? = 1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('throws exception for MSSQL as it does not support REGEXP', () => {
      const condition = new Field('regex', 'email', /@/)
      expect(() => {
        interpret(condition, { ...mssql })
      }).to.throw(/"regexp" operator is not supported in MSSQL/)
    })
  })

  describe('relation conditions', () => {
    const interpret = createSqlInterpreter({
      eq,
      some: someRelation,
      every: everyRelation,
      none: noneRelation
    })
    const condition = new Field('some', 'wallets', new Field('eq', 'balance', 5))

    it('generates EXISTS query for simple relation metadata', () => {
      const interpreterOptions: SqlQueryOptions = {
        ...options,
        rootAlias: 'users',
        getRelationMetadata: () => ({
          parentField: 'id',
          relationField: 'userId',
          relationTable: 'user_wallets',
        })
      }
      const [sql, params] = interpret(condition, interpreterOptions)

      expect(sql).to.equal('EXISTS (SELECT 1 FROM "user_wallets" as "wallets_0" WHERE "users"."id" = "wallets_0"."userId" AND ("wallets_0"."balance" = $1))')
      expect(params).to.deep.equal([5])
    })

    it('allows custom relation SQL to add parameters before nested condition SQL', () => {
      const interpreterOptions: SqlQueryOptions = {
        ...options,
        rootAlias: 'users',
        getRelationMetadata: () => ({
          buildRelationQuery(relation) {
            return `SELECT 1 FROM ${relation.escapeField('wallets')} as ${relation.escapeField(relation.relationAlias)}` +
            ` WHERE ${relation.parentField('id')} = ${relation.relationField('userId')}` +
            ` AND ${relation.relationField('kind')} = ${relation.param('primary')}` +
            ` AND (${relation.conditionSql()})`
          }
        })
      }
      const [sql, params] = interpret(condition, interpreterOptions)

      expect(sql).to.equal('EXISTS (SELECT 1 FROM "wallets" as "wallets_0" WHERE "users"."id" = "wallets_0"."userId" AND "wallets_0"."kind" = $1 AND ("wallets_0"."balance" = $2))')
      expect(params).to.deep.equal(['primary', 5])
    })
  })
})
