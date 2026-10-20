import { CompoundCondition, FieldCondition } from '@ucast/core'
import { and as drizzleAnd, eq as drizzleEq, relations, sql, Table } from 'drizzle-orm'
import { customType, integer, SQLiteSyncDialect, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { MySqlDialect, mysqlTable, int } from 'drizzle-orm/mysql-core'
import { PgDialect, pgSchema, pgTable, integer as pgInteger } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/better-sqlite3'
// @ts-expect-error better-sqlite3 has no types
import Database from 'better-sqlite3'
import { createDrizzleInterpreter } from '../../src/lib/drizzle-orm/v0.x.ts'
import { eq, type SqlOperator } from '../../src/index.ts'
import { expect } from '../specHelper.ts'

describe(`${createDrizzleInterpreter.name} v0.x`, () => {
  const cases: [string, unknown, string, unknown[]][] = [
    ['eq', 18, '= ?', [18]],
    ['ne', 18, '<> ?', [18]],
    ['lt', 18, '< ?', [18]],
    ['lte', 18, '<= ?', [18]],
    ['gt', 18, '> ?', [18]],
    ['gte', 18, '>= ?', [18]],
    ['eq', null, 'is null', []],
    ['ne', null, 'is not null', []],
    ['exists', true, 'is not null', []],
    ['exists', false, 'is null', []],
    ['in', [1, 2], 'in(?, ?)', [1, 2]],
    ['within', [1, 2], 'in(?, ?)', [1, 2]],
    ['nin', [1, 2], 'not in(?, ?)', [1, 2]],
  ]
  cases.forEach(([operator, value, suffix, params]) => {
    it(`preserves shared ${operator} semantics with ${JSON.stringify(value)}`, () => {
      const { render } = setup()
      const query = render(new FieldCondition(operator, 'age', value))
      expect(query.sql).to.equal(`"users"."age" ${suffix}`)
      expect(query.params).to.deep.equal(params)
    })
  })

  it('binds modulo operands without a column encoder', () => {
    const { render } = setup()
    const query = render(new FieldCondition('mod', 'code', [3, 1]))
    expect(query.sql).to.equal('mod("users"."code", ?) = ?')
    expect(query.params).to.deep.equal([3, 1])
  })

  it('maps properties to columns', () => {
    const { render } = setup()
    expect(render(new FieldCondition('eq', 'displayName', 'A')).sql)
      .to.equal('"users"."display_name" = ?')
  })

  it('throws on unknown column names', () => {
    const { render } = setup()
    ;['missing.field', 'toString', 'constructor', '__proto__', 'a"b'].forEach(name => {
      expect(() => render(new FieldCondition('eq', name, 1)).sql)
        .to.throw(/Uknown column/)
    })
  })

  it('lets Drizzle apply casing on each rendering', () => {
    const { interpret, dialect } = setup()
    const predicate = interpret(new FieldCondition('eq', 'camelCase', 'A'), 'users')
    expect(dialect.sqlToQuery(predicate).sql).to.equal('"users"."camelCase" = ?')
    expect(new SQLiteSyncDialect({ casing: 'snake_case' }).sqlToQuery(predicate).sql)
      .to.equal('"users"."camel_case" = ?')
  })

  it('supports query-specific aliases independently', () => {
    const { interpret, dialect, render } = setup()
    const condition = new FieldCondition('eq', 'displayName', 'A')
    const first = interpret(condition, 'users', { alias: 'first' })
    expect(dialect.sqlToQuery(first).sql).to.equal('"first"."display_name" = ?')

    const second = interpret(condition, 'users', { alias: 'second' })
    expect(dialect.sqlToQuery(second).sql).to.equal('"second"."display_name" = ?')

    expect(render(condition).sql).to.equal('"users"."display_name" = ?')
  })

  it('binds comparison and each membership value with native encoders', () => {
    const { interpret, dialect, render } = setup()
    const date = new Date('2025-01-01T00:00:00Z')
    expect(render(new FieldCondition('eq', 'active', true)).params).to.deep.equal([1])
    expect(render(new FieldCondition('eq', 'createdAt', date)).params)
      .to.deep.equal([date.getTime() / 1000])

    const predicate = interpret(new FieldCondition('in', 'code', ['A', 'B']), 'users')
    expect(dialect.sqlToQuery(predicate).params).to.deep.equal(['encoded:A', 'encoded:B'])
    expect(dialect.sqlToQuery(predicate).params).to.deep.equal(['encoded:A', 'encoded:B'])
  })

  it('uses shared regex dialect syntax and binds the pattern without column encoding', () => {
    const pgUsers = pgSchema('app').table('users', { code: pgInteger('code') })
    const myUsers = mysqlTable('users', { code: int('code') })
    const interpret = createDrizzleInterpreter({ schema: { pgUsers, myUsers } })

    const condition = new FieldCondition('regex', 'code', /a.*/)
    const ignoreCaseCondition = new FieldCondition('regex', 'code', /a.*/)

    const pgQuery = new PgDialect().sqlToQuery(interpret(condition, 'pgUsers'))
    expect(pgQuery.sql).to.equal(`"app"."users"."code" ~ $1`)
    expect(pgQuery.params).to.deep.equal(['a.*'])

    const pgQuery2 = new PgDialect().sqlToQuery(interpret(ignoreCaseCondition, 'pgUsers'))
    expect(pgQuery2.sql).to.equal(`"app"."users"."code" ~ $1`)

    const mysqlQuery = new MySqlDialect().sqlToQuery(interpret(condition, 'myUsers'))
    expect(mysqlQuery.sql).to.equal('`users`.`code` regexp ? = 1')
    expect(mysqlQuery.params).to.deep.equal(['a.*'])

    const mysqlQuery2 = new MySqlDialect().sqlToQuery(interpret(condition, 'myUsers'))
    expect(mysqlQuery2.sql).to.equal('`users`.`code` regexp ? = 1')
  })

  it('composes drizzle predicates and preserves PostgreSQL placeholder ordering', () => {
    const table = pgTable('users', { age: pgInteger('age') })
    const interpret = createDrizzleInterpreter({ schema: { table } })
    const tricky = "$1 ? '; DROP TABLE users; --"
    const predicate = interpret(new FieldCondition('eq', 'age', tricky), 'table')
    const query = new PgDialect().sqlToQuery(sql`${1} and ${drizzleAnd(drizzleEq(table.age, 2), predicate)} and ${3}`)

    expect(query.sql).to.equal('$1 and ("users"."age" = $2 and "users"."age" = $3) and $4')
    expect(query.params).to.deep.equal([1, 2, tricky, 3])
    expect(new PgDialect().sqlToQuery(predicate).params).to.deep.equal([tricky])
  })

  it('supports selected and custom interpreters with native fragments', () => {
    const { dialect, schema } = setup()
    const custom: SqlOperator<FieldCondition> = (condition, composer) => composer.sql`${composer.field('age')} + ${composer.param(condition.value)}`
    const interpret = createDrizzleInterpreter({ schema }, { eq, custom })

    expect(dialect.sqlToQuery(interpret(new FieldCondition('custom', 'age', 2), 'users')).sql)
      .to.equal('"users"."age" + ?')
    expect(() => interpret(new FieldCondition('gt', 'age', 2), 'users')).to.throw('Unable to interpret')
  })

  it('rejects unsupported tables, non-table keys, and unknown relations', () => {
    const { interpret } = setup()
    const condition = new FieldCondition('eq', 'age', 1)

    expect(() => interpret(condition, 'userRelations' as any)).to.throw('Unknown table schema key')
    expect(() => interpret(condition, 'missing' as any)).to.throw('Unknown table schema key')
    expect(() => interpret(condition, 'toString' as any)).to.throw('Unknown table schema key')

    const unsupported = createDrizzleInterpreter({ schema: { table: new Table('users', undefined, 'users') } })
    expect(() => unsupported(condition, 'table')).to.throw('Uknown table type "Table". Supported PgTable, MySqlTable, SQLiteTable')
    ;['some', 'none', 'every'].forEach(operator => {
      expect(() => interpret(new FieldCondition(operator, 'posts', condition), 'users'))
        .to.throw('Relation metadata for "users.posts" not found')
    })
  })

  it('prevents native SQL values from becoming executable syntax', () => {
    const { interpret, render } = setup()

    expect(() => interpret(new FieldCondition('eq', 'age', sql.raw('1 or true')), 'users'))
      .to.throw('SQL fragments are not supported as condition values')
    expect(() => interpret(new FieldCondition('in', 'age', [sql.raw('1 or true')]), 'users'))
      .to.throw('SQL fragments are not supported as condition values')
    const wrapper = { getSQL: () => sql.raw('1 or true') }
    expect(render(new FieldCondition('eq', 'age', wrapper)).params).to.deep.equal([wrapper])
  })

  describe('compound operators', () => {
    it("preserves `and` grouping", () => {
      const { render } = setup()

      const condition = new CompoundCondition('and', [
        new FieldCondition('eq', 'age', 18),
        new CompoundCondition('or', [new FieldCondition('eq', 'age', 20)]),
      ])
      const query = render(condition)

      expect(query.sql).to.equal(`("users"."age" = ? and ("users"."age" = ?))`)
      expect(query.params).to.deep.equal([18, 20])
    })

    it("preserves `or` grouping", () => {
      const { render } = setup()
      const condition = new CompoundCondition('or', [
        new FieldCondition('eq', 'age', 18),
        new CompoundCondition('or', [new FieldCondition('eq', 'age', 20)]),
      ])
      const query = render(condition)

      expect(query.sql).to.equal(`("users"."age" = ? or ("users"."age" = ?))`)
      expect(query.params).to.deep.equal([18, 20])
    })

    it("preserves `not` grouping", () => {
      const { render } = setup()
      const condition = new CompoundCondition('not', [
        new FieldCondition('eq', 'age', 18),
        new CompoundCondition('or', [new FieldCondition('eq', 'age', 20)]),
      ])
      const query = render(condition)

      expect(query.sql).to.equal(`not ("users"."age" = ? and ("users"."age" = ?))`)
      expect(query.params).to.deep.equal([18, 20])
    })

    it("preserves `nor` grouping", () => {
      const { render } = setup()
      const condition = new CompoundCondition('nor', [
        new FieldCondition('eq', 'age', 18),
        new CompoundCondition('or', [new FieldCondition('eq', 'age', 20)]),
      ])
      const query = render(condition)

      expect(query.sql).to.equal(`not ("users"."age" = ? or ("users"."age" = ?))`)
      expect(query.params).to.deep.equal([18, 20])
    })
  })

  describe('e2e execution', () => {
    it('executes scalar and Boolean predicates in SQLite with native encoding', () => {
      const { interpret } = setup()
      const connection = new Database(':memory:')
      const db = drizzle(connection)

      try {
        connection.exec('CREATE TABLE users (id integer, display_name text, age integer, active integer, created_at integer, code text, camelCase text)')
        db.insert(users).values([
          { id: 1, age: 18, active: true, code: 'A' },
          { id: 2, age: 25, active: false, code: 'B' },
          { id: 3, age: 30, active: true, code: 'C' },
        ]).run()
        const predicate = interpret(new CompoundCondition('and', [
          new FieldCondition('gte', 'age', 20),
          new FieldCondition('eq', 'active', true),
          new FieldCondition('in', 'code', ['A', 'C']),
        ]), 'users')
        const native = drizzleAnd(
          drizzleEq(users.active, true),
          drizzleEq(users.code, 'C')
        )

        expect(db.select().from(users).where(predicate).all())
          .to.deep.equal(db.select().from(users).where(native).all())
        expect(db.update(users).set({ displayName: 'Changed' }).where(predicate).run().changes).to.equal(1)
        expect(db.delete(users).where(predicate).run().changes).to.equal(1)
      } finally {
        connection.close()
      }
    })
  })

  const encoded = customType<{ data: string; driverData: string }>({
    dataType: () => 'text',
    toDriver: value => `encoded:${value}`,
    fromDriver: value => value.slice('encoded:'.length),
  })
  const users = sqliteTable('users', {
    id: integer('id'),
    displayName: text('display_name'),
    age: integer('age'),
    active: integer('active', { mode: 'boolean' }),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    code: encoded('code'),
    camelCase: text(),
  })
  const userRelations = relations(users, () => ({}))

  function setup() {
    const schema = { users, userRelations }
    const interpret = createDrizzleInterpreter({ schema })
    const dialect = new SQLiteSyncDialect()
    const render = (condition: FieldCondition | CompoundCondition) => dialect.sqlToQuery(interpret(condition, 'users'))

    return { schema, interpret, dialect, render }
  }
})
