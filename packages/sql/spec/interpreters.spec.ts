import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import { expect, spy } from './specHelper'
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
  elemMatch,
  regex,
  SqlQueryOptions,
  pg,
  oracle,
  mysql,
  mssql
} from '../src'

const joinRelation = () => true
const options: SqlQueryOptions = {
  ...pg,
  joinRelation,
}

describe('Condition Interpreter', () => {
  describe('auto join', () => {
    const interpret = createSqlInterpreter({ eq })
    const condition = new Field('eq', 'projects.name', 'test')

    before(() => {
      spy.on(options, 'joinRelation')
    })

    after(() => {
      spy.restore(options, 'joinRelation')
    })

    it('calls `joinRelation` function passing relation name when using dot notation', () => {
      interpret(condition, options)
      expect(options.joinRelation).to.have.been.called.with('projects')
    })

    it('escapes relation name with `options.escapeField`', () => {
      spy.on(options, 'escapeField')
      const [sql] = interpret(condition, options)

      expect(sql).to.equal('"projects"."name" = $1')
      expect(options.escapeField).to.have.been.called.with('projects')
      spy.restore(options, 'escapeField')
    })
  })

  describe('auto join on multiple relations', () => {
    const interpret = createSqlInterpreter({ eq, lte, and })
    const date = new Date()
    const condition = new CompoundCondition('and', [
      new Field('eq', 'projects.name', 'test'),
      new Field('eq', 'users.deleted', false),
      new Field('lte', 'posts.created_at', date),
    ])

    before(() => {
      spy.on(options, 'joinRelation')
    })

    after(() => {
      spy.restore(options, 'joinRelation')
    })

    it('generates query with multiple relations', () => {
      const [sql, params, joins] = interpret(condition, options)

      expect(sql).to.equal('("projects"."name" = $1 and "users"."deleted" = $2 and "posts"."created_at" <= $3)')
      expect(params).to.deep.equal(['test', false, date])
      expect(joins).to.deep.equal(['projects', 'users', 'posts'])
    })
  })

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

      expect(sql).to.equal('not ("age" = $1 or "age" = $2)')
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
        '("age" = $1 or "age" = $2)',
        'or ("qty" > $3 and "qty" < $4)',
        'or not ("qty" > $5 or "qty" < $6)',
        'or not ("active" = $7 and "age" > $8)'
      ].join(' '))
      expect(params).to.deep.equal([1, 2, 1, 20, 10, 20, false, 18])
    })
  })

  describe('elemMatch', () => {
    const interpret = createSqlInterpreter({ elemMatch, eq, or, and, lt, gt })

    it('generates query from a field condition based on relation', () => {
      const condition = new Field('elemMatch', 'projects', new Field('eq', 'active', true))
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('"projects"."active" = $1')
      expect(params).to.deep.equal([true])
    })

    it('generates query from a compound condition based on relation', () => {
      const condition = new Field('elemMatch', 'projects', new CompoundCondition('and', [
        new Field('gt', 'count', 5),
        new Field('lt', 'count', 10),
      ]))
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("projects"."count" > $1 and "projects"."count" < $2)')
      expect(params).to.deep.equal([5, 10])
    })

    it('calls "joinRelation" option for every field', () => {
      spy.on(options, 'joinRelation')
      const condition = new Field('elemMatch', 'projects', new CompoundCondition('and', [
        new Field('gt', 'count', 5),
        new Field('lt', 'count', 10),
      ]))
      interpret(condition, options)

      expect(options.joinRelation).to.have.been.called.twice
      spy.restore(options, 'joinRelation')
    })
  })

  describe('regex', () => {
    const interpret = createSqlInterpreter({ regex })

    it('generates posix operator for PostgreSQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...pg, joinRelation })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates posix operator for Oracle', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...oracle, joinRelation })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates call to `REGEXP` function for MySQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...mysql, joinRelation })

      expect(sql).to.equal('`email` regexp ? = 1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('throws exception for MSSQL as it does not support REGEXP', () => {
      const condition = new Field('regex', 'email', /@/)
      expect(() => {
        interpret(condition, { ...mssql, joinRelation })
      }).to.throw(/"regexp" operator is not supported in MSSQL/)
    })
  })
})
