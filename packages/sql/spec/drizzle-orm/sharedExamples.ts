import { expect } from '../specHelper.ts'
import { FieldCondition, CompoundCondition, type Condition } from '@ucast/core'
// @ts-expect-error better-sqlite3 has no types
import Database from 'better-sqlite3'

import { allInterpreters, eq, type SqlOperator } from '../../src/index.ts'
import type {
  DrizzleInterpreterOptions, DrizzleQueryOptions,
} from '../../src/lib/drizzle-orm/base.ts'

export interface RelationDefinition {
  target: string;
  kind?: 'one' | 'many';
  from: string[];
  to: string[];
}

export type RelationDefinitions = Record<string, Record<string, RelationDefinition>>;

type Query = { sql: string; params: unknown[] }
type Dialect = { sqlToQuery(expression: any): Query }
type Interpret<TTable extends string = string> = (
  condition: Condition, table: TTable, options?: DrizzleQueryOptions
) => any

export interface DrizzleInterpreterExampleOptions {
  setup(encoded: (name: string) => any): {
    render(condition: Condition): Query;
    interpret: Interpret<'users'>;
    dialect: Dialect;
    schema: Record<string, any>;
  };
  createDrizzleInterpreter(
    options: DrizzleInterpreterOptions<Record<string, any>>,
    operators?: Record<string, SqlOperator<any, any>>
  ): Interpret;
  /** Declare native relations using the selected Drizzle version. */
  setupRelations(
    tables: Record<string, any>, definitions: RelationDefinitions
  ): Record<string, any>;
  // Native generic types differ between Drizzle versions; modules stay at the runtime boundary.
  drizzle: Record<string, any>;
  pg: Record<string, any>;
  mysql: Record<string, any>;
  sqlite: Record<string, any>;
  aliases: Record<string, any>;
  betterSqlite3: Record<string, any>;
}

export function includeDrizzleInterpreterExamples({
  setup: setupExample,
  createDrizzleInterpreter,
  setupRelations,
  drizzle,
  pg,
  mysql,
  sqlite,
  aliases,
  betterSqlite3,
}: DrizzleInterpreterExampleOptions) {
  const encoded = sqlite.customType({
    dataType: () => 'text',
    toDriver: (value: string) => `encoded:${value}`,
    fromDriver: (value: string) => value.slice('encoded:'.length),
  })
  const setup = () => setupExample(encoded)

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

  it('preserves unknown column names as literal identifiers', () => {
    const { render } = setup()
    const fieldEq = (name: string, value: unknown) =>
      render(new FieldCondition('eq', name, value)).sql;

    expect(fieldEq('missing.field', 1)).to.equal(`"users"."missing.field" = ?`)
    expect(fieldEq('toString', 'test')).to.equal(`"users"."toString" = ?`)
    expect(fieldEq('constructor', 'test')).to.equal(`"users"."constructor" = ?`)
    expect(fieldEq('__proto__', 'test')).to.equal(`"users"."__proto__" = ?`)
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
    const pgUsers = pg.pgSchema('app').table('users', { code: pg.integer('code') })
    const myUsers = mysql.mysqlTable('users', { code: mysql.int('code') })
    const interpret = createDrizzleInterpreter({ schema: { pgUsers, myUsers } })

    const condition = new FieldCondition('regex', 'code', /a.*/)
    const ignoreCaseCondition = new FieldCondition('regex', 'code', /a.*/i)

    const pgQuery = new pg.PgDialect().sqlToQuery(interpret(condition, 'pgUsers'))
    expect(pgQuery.sql).to.equal(`"app"."users"."code" ~ $1`)
    expect(pgQuery.params).to.deep.equal(['a.*'])

    const pgQuery2 = new pg.PgDialect().sqlToQuery(interpret(ignoreCaseCondition, 'pgUsers'))
    expect(pgQuery2.sql).to.equal(`"app"."users"."code" ~* $1`)
    expect(pgQuery2.params).to.deep.equal(['a.*'])

    const mysqlQuery = new mysql.MySqlDialect().sqlToQuery(interpret(condition, 'myUsers'))
    expect(mysqlQuery.sql).to.equal('`users`.`code` regexp ? = 1')
    expect(mysqlQuery.params).to.deep.equal(['a.*'])

    const mysqlQuery2 = new mysql.MySqlDialect().sqlToQuery(interpret(ignoreCaseCondition, 'myUsers'))
    expect(mysqlQuery2.sql).to.equal('`users`.`code` regexp ? = 1')
    expect(mysqlQuery2.params).to.deep.equal(['a.*'])
  })

  it('composes drizzle predicates and preserves PostgreSQL placeholder ordering', () => {
    const table = pg.pgTable('users', { age: pg.integer('age') })
    const interpret = createDrizzleInterpreter({ schema: { table } })
    const tricky = "$1 ? '; DROP TABLE users; --"
    const predicate = interpret(new FieldCondition('eq', 'age', tricky), 'table')
    const query = new pg.PgDialect().sqlToQuery(drizzle.sql`${1} and ${drizzle.and(drizzle.eq(table.age, 2), predicate)} and ${3}`)

    // Drizzle v1 also wraps each operand of its native `and` in parentheses.
    expect(query.sql).to.be.oneOf([
      '$1 and ("users"."age" = $2 and "users"."age" = $3) and $4',
      '$1 and (("users"."age" = $2) and ("users"."age" = $3)) and $4',
    ])
    expect(query.params).to.deep.equal([1, 2, tricky, 3])
    expect(new pg.PgDialect().sqlToQuery(predicate).params).to.deep.equal([tricky])
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

    const unsupported = createDrizzleInterpreter({ schema: { table: new drizzle.Table('users', undefined, 'users') } })
    expect(() => unsupported(condition, 'table')).to.throw('Uknown table type "Table". Supported PgTable, MySqlTable, SQLiteTable')
    ;['some', 'none', 'every'].forEach(operator => {
      expect(() => interpret(new FieldCondition(operator, 'posts', condition), 'users'))
        .to.throw('Relation metadata for "users.posts" not found')
    })
  })

  it('prevents native SQL values from becoming executable syntax', () => {
    const { interpret, render } = setup()

    expect(() => interpret(new FieldCondition('eq', 'age', drizzle.sql.raw('1 or true')), 'users'))
      .to.throw('SQL fragments are not supported as condition values')
    expect(() => interpret(new FieldCondition('in', 'age', [drizzle.sql.raw('1 or true')]), 'users'))
      .to.throw('SQL fragments are not supported as condition values')
    const wrapper = { getSQL: () => drizzle.sql.raw('1 or true') }
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

  describe('relations', () => {
    const relation = (operator: string, name: string, predicate: Condition) =>
      new FieldCondition(operator, name, predicate)
    const some = (name: string, predicate: Condition) => relation('some', name, predicate)

    for (const [operator, expected] of [
      ['some', ['Bob']], ['is', ['Bob']],
      ['none', ['Ada', 'Empty', 'Other']], ['isNot', ['Ada', 'Empty', 'Other']],
      // NULL is not a counterexample; users without posts also satisfy `every`.
      ['every', ['Bob', 'Empty', 'Other']],
    ] as [string, string[]][]) {
      it(`executes ${operator} with composite joins, NULLs and empty relations`, () => {
        const { connection, names, published } = setupRelationExamples()
        try {
          expect(names(relation(operator, 'posts', published))).to.deep.equal(expected)
        } finally {
          connection.close()
        }
      })
    }

    it('follows to-one, nested, junction and self relations', () => {
      const { connection, db, posts, interpret, names, published } = setupRelationExamples()
      try {
        const bob = new FieldCondition('eq', 'name', 'Bob')
        const author = some('author', bob)
        expect(db.select({ id: posts.id }).from(posts).where(interpret(author, 'posts')).all())
          .to.deep.equal([{ id: 2 }, { id: 3 }])
        expect(names(some('posts', author))).to.deep.equal(['Bob'])
        expect(names(some('bookmarks', some('post', published)))).to.deep.equal(['Ada'])
        expect(names(some('children', bob))).to.deep.equal(['Ada'])
      } finally {
        connection.close()
      }
    })

    it('keeps outer aliases and repeated relation aliases independent', () => {
      const { connection, interpret, names, published } = setupRelationExamples()
      try {
        const condition = some('posts', published)
        const repeated = new CompoundCondition('and', [condition, condition])
        expect(names(repeated, 'u')).to.deep.equal(['Bob'])
        const query = setup().dialect.sqlToQuery(interpret(repeated, 'users', { alias: 'u' }))
        expect(query.sql).to.contain('"u_ucast_0"').and.contain('"u_ucast_1"')
        expect(query.params).to.deep.equal([1, 1])
        expect(names(condition)).to.deep.equal(['Bob'])
      } finally {
        connection.close()
      }
    })

    it('composes custom operators inside relations', () => {
      const { connection, db, schema, users } = setupRelationExamples()
      try {
        const prefix: SqlOperator<FieldCondition> = (condition, composer) =>
          composer.sql`${composer.field(condition.field)} LIKE ${composer.param(`${condition.value}%`)}`
        const custom = createDrizzleInterpreter({ schema }, { ...allInterpreters, prefix })
        const condition = some('posts', new FieldCondition('prefix', 'title', 'Pub'))
        expect(db.select({ name: users.name }).from(users).where(custom(condition, 'users')).all())
          .to.deep.equal([{ name: 'Bob' }])
      } finally {
        connection.close()
      }
    })

    it('uses correlated predicates in UPDATE and DELETE', () => {
      const { connection, db, users, interpret, published } = setupRelationExamples()
      try {
        const predicate = interpret(some('posts', published), 'users')
        expect(db.update(users).set({ name: 'Changed' }).where(predicate).run().changes).to.equal(1)
        expect(db.delete(users).where(predicate).run().changes).to.equal(1)
        const remaining = db.select({ name: users.name }).from(users).all()
          .map((row: { name: string }) => row.name).sort()
        expect(remaining).to.deep.equal(['Ada', 'Empty', 'Other'])
      } finally {
        connection.close()
      }
    })

    it('preserves dialect syntax, schema qualification and surrounding parameter order', () => {
      const app = pg.pgSchema('app')
      for (const [authors, articles, dialect, quote, tableName, bind] of [
        [app.table('authors', { id: pg.integer('id') }),
          app.table('articles', { authorId: pg.integer('author_id') }),
          new pg.PgDialect(), '"', '"app"."articles"', (n: number) => `$${n}`],
        [mysql.mysqlTable('authors', { id: mysql.int('id') }),
          mysql.mysqlTable('articles', { authorId: mysql.int('author_id') }),
          new mysql.MySqlDialect(), '`', '`articles`', (_n: number) => '?'],
        [sqlite.sqliteTable('authors', { id: sqlite.integer('id') }),
          sqlite.sqliteTable('articles', { authorId: sqlite.integer('author_id') }),
          setup().dialect, '"', '"articles"', (_n: number) => '?'],
      ] as const) {
        const schema = setupRelations({ authors, articles }, {
          authors: { articles: { target: 'articles', from: ['id'], to: ['authorId'] } },
        })
        const interpret = createDrizzleInterpreter({ schema })
        const condition = some('articles', new FieldCondition('eq', 'authorId', 2))
        const predicate = interpret(condition, 'authors', { alias: 'a' })
        const query = dialect.sqlToQuery(drizzle.sql`${'before'} AND ${predicate} AND ${'after'}`)
        const column = (table: string, name: string) => `${quote}${table}${quote}.${quote}${name}${quote}`
        expect(query.sql).to.equal([
          `${bind(1)} AND EXISTS (SELECT 1 FROM ${tableName} as ${quote}a_ucast_0${quote} `,
          `WHERE (${column('a', 'id')} = ${column('a_ucast_0', 'author_id')}) `,
          `AND (${column('a_ucast_0', 'author_id')} = ${bind(2)})) AND ${bind(3)}`,
        ].join(''))
        expect(query.params).to.deep.equal(['before', 2, 'after'])
      }
    })

    it('rejects cross-dialect relations and missing target tables', () => {
      const { connection, users, posts } = setupRelationExamples()
      try {
        const definitions = { users: { posts: { target: 'posts', from: ['id'], to: ['userId'] } } }
        const foreignPosts = pg.pgTable('posts', { userId: pg.integer('user_id') })
        expect(() => createDrizzleInterpreter({
          schema: setupRelations({ users, posts: foreignPosts }, definitions),
        })).to.throw(/Cross-dialect/)
        const incomplete = setupRelations({ users, posts }, definitions)
        delete incomplete.posts
        expect(() => createDrizzleInterpreter({ schema: incomplete }))
          .to.throw(/not found|Unsupported metadata/)
      } finally {
        connection.close()
      }
    })

    function setupRelationExamples() {
      const published = new FieldCondition('eq', 'active', true)
      const users = sqlite.sqliteTable('users', {
        id: sqlite.integer('id'),
        parentId: sqlite.integer('parent_id'),
        tenant: sqlite.text('tenant'),
        name: sqlite.text('name'),
      })
      const posts = sqlite.sqliteTable('posts', {
        id: sqlite.integer('id'),
        userId: sqlite.integer('user_id'),
        tenant: sqlite.text('tenant'),
        title: sqlite.text('post_title'),
        active: sqlite.integer('active', { mode: 'boolean' }),
      })
      const bookmarks = sqlite.sqliteTable('bookmarks', {
        userId: sqlite.integer('user_id'),
        postId: sqlite.integer('post_id'),
        tenant: sqlite.text('tenant'),
      })
      const schema = setupRelations({ users, posts, bookmarks }, {
        users: {
          posts: { target: 'posts', from: ['id', 'tenant'], to: ['userId', 'tenant'] },
          children: { target: 'users', from: ['id', 'tenant'], to: ['parentId', 'tenant'] },
          bookmarks: { target: 'bookmarks', from: ['id', 'tenant'], to: ['userId', 'tenant'] },
        },
        posts: {
          author: { target: 'users', kind: 'one', from: ['userId', 'tenant'], to: ['id', 'tenant'] },
        },
        bookmarks: {
          post: { target: 'posts', kind: 'one', from: ['postId', 'tenant'], to: ['id', 'tenant'] },
        },
      })
      const interpret = createDrizzleInterpreter({ schema })
      const names = (condition: Condition, alias?: string) => {
        const table = alias ? aliases.aliasedTable(users, alias) : users
        return db.select({ name: table.name }).from(table)
          .where(interpret(condition, 'users', { alias })).all()
          .map((row: { name: string }) => row.name).sort()
      }

      const connection = new Database(':memory:')
      const db = betterSqlite3.drizzle({ client: connection })
      // Duplicate user IDs across tenants expose incomplete composite joins.
      connection.exec(`
        CREATE TABLE users(id integer, parent_id integer, tenant text, name text);
        CREATE TABLE posts(id integer, user_id integer, tenant text, post_title text, active integer);
        CREATE TABLE bookmarks(user_id integer, post_id integer, tenant text);
        INSERT INTO users VALUES (1,NULL,'a','Ada'), (2,1,'a','Bob'),
          (1,NULL,'b','Other'), (3,NULL,'a','Empty');
        INSERT INTO posts VALUES (1,1,'a','Draft',0), (2,2,'a','Published',1),
          (3,2,'a','Nullable',NULL);
        INSERT INTO bookmarks VALUES (1,2,'a');
      `)

      return { connection, db, schema, interpret, users, posts, names, published }
    }
  })

  describe('e2e execution', () => {
    const users = sqlite.sqliteTable('users', {
      id: sqlite.integer('id'),
      displayName: sqlite.text('display_name'),
      age: sqlite.integer('age'),
      active: sqlite.integer('active', { mode: 'boolean' }),
      createdAt: sqlite.integer('created_at', { mode: 'timestamp' }),
      code: encoded('code'),
      camelCase: sqlite.text(),
    })

    it('executes scalar and Boolean predicates in SQLite with native encoding', () => {
      const { interpret } = setup()
      const connection = new Database(':memory:')
      const db = betterSqlite3.drizzle({ client: connection })

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
        const native = drizzle.and(
          drizzle.eq(users.active, true),
          drizzle.eq(users.code, 'C')
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
}
