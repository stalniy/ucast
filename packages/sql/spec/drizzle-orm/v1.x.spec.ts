import { FieldCondition, type Condition } from '@ucast/core'
import * as drizzle from 'drizzle-orm-v1'
import * as sqlite from 'drizzle-orm-v1/sqlite-core'
import * as pg from 'drizzle-orm-v1/pg-core'
import * as mysql from 'drizzle-orm-v1/mysql-core'
import * as aliases from 'drizzle-orm-v1/alias'
import * as betterSqlite3 from 'drizzle-orm-v1/better-sqlite3'
import { createDrizzleInterpreter } from '../../src/lib/drizzle-orm/v1.x.ts'
import { includeDrizzleInterpreterExamples, type RelationDefinitions } from './sharedExamples.ts'
import { expect } from '../specHelper.ts'
// @ts-expect-error better-sqlite3 has no types
import Database from 'better-sqlite3'

describe(`${createDrizzleInterpreter.name} v1.x`, () => {
  includeDrizzleInterpreterExamples({
    setup,
    createDrizzleInterpreter,
    setupRelations,
    drizzle,
    pg,
    mysql,
    sqlite,
    aliases,
    betterSqlite3,
  })

  it('supports native column casing at table construction time', () => {
    const users = sqlite.sqliteTable('users', { camelCase: sqlite.text() })
    const interpret = createDrizzleInterpreter({ schema: { users } })
    const condition = new FieldCondition('eq', 'camelCase', 'A')
    const dialect = new sqlite.SQLiteDialect()
    expect(dialect.sqlToQuery(interpret(condition, 'users')).sql)
      .to.equal('"users"."camelCase" = ?')

    const table = sqlite.sqliteTableCreator(name => name, 'snake_case')
    const casedUsers = table('users', { camelCase: sqlite.text() })
    const casedInterpret = createDrizzleInterpreter({ schema: { users: casedUsers } })
    const query = dialect.sqlToQuery(casedInterpret(condition, 'users'))
    expect(query.sql).to.equal('"users"."camel_case" = ?')
    expect(query.params).to.deep.equal(['A'])
  })

  it('preserves native through relations and predefined filters', () => {
    const users = sqlite.sqliteTable('users', {
      id: sqlite.integer('id'), name: sqlite.text('name'),
    })
    const roles = sqlite.sqliteTable('roles', {
      id: sqlite.integer('id'), name: sqlite.text('role_name'),
      active: sqlite.integer('active', { mode: 'boolean' }),
    })
    const userRoles = sqlite.sqliteTable('user_roles', {
      userId: sqlite.integer('user_id'), roleId: sqlite.integer('role_id'),
    })
    const relations = drizzle.defineRelations({ users, roles, userRoles }, r => ({
      users: {
        roles: r.many.roles({
          from: r.users.id.through(r.userRoles.userId),
          to: r.roles.id.through(r.userRoles.roleId),
        }),
        activeRoles: r.many.roles({
          from: r.users.id.through(r.userRoles.userId),
          to: r.roles.id.through(r.userRoles.roleId),
          where: { active: true },
        }),
      },
    }))
    const interpret = createDrizzleInterpreter({ schema: { users, roles, userRoles, relations } })
    const connection = new Database(':memory:')
    try {
      connection.exec(`
        CREATE TABLE users(id integer, name text);
        CREATE TABLE roles(id integer, role_name text, active integer);
        CREATE TABLE user_roles(user_id integer, role_id integer);
        INSERT INTO users VALUES (1,'Ada'), (2,'Bob'), (3,'Empty');
        INSERT INTO roles VALUES (1,'allowed',1), (2,'outside',0);
        INSERT INTO user_roles VALUES (1,1), (1,2), (2,2);
      `)
      const db = betterSqlite3.drizzle({ client: connection })
      const names = (condition: Condition) => db.select().from(users)
        .where(interpret(condition, 'users')).all().map(row => row.name)
      const allowed = new FieldCondition('eq', 'name', 'allowed')
      const outside = new FieldCondition('eq', 'name', 'outside')

      expectSql(interpret(some('roles', allowed), 'users'), [
        'EXISTS (SELECT 1 FROM "roles" as "users_ucast_0" ',
        'INNER JOIN "user_roles" as "users_ucast_1" ',
        'ON "users_ucast_1"."role_id" = "users_ucast_0"."id" ',
        'WHERE ("users"."id" = "users_ucast_1"."user_id") ',
        'AND ("users_ucast_0"."role_name" = ?))',
      ].join(''), ['allowed'])
      expect(names(some('roles', allowed))).to.deep.equal(['Ada'])
      expect(names(some('activeRoles', outside))).to.deep.equal([])
      expect(names(relation('none', 'activeRoles', outside))).to.deep.equal(['Ada', 'Bob', 'Empty'])
      expect(names(relation('every', 'activeRoles', allowed))).to.deep.equal(['Ada', 'Bob', 'Empty'])
      expectSql(interpret(relation('every', 'activeRoles', allowed), 'users'), [
        'NOT EXISTS (SELECT 1 FROM "roles" as "users_ucast_0" ',
        'INNER JOIN "user_roles" as "users_ucast_1" ',
        'ON "users_ucast_1"."role_id" = "users_ucast_0"."id" ',
        'WHERE ((("users_ucast_0"."active" = ?) ',
        'and ("users"."id" = "users_ucast_1"."user_id"))) ',
        'AND (NOT ("users_ucast_0"."role_name" = ?)))',
      ].join(''), [1, 'allowed'])
    } finally {
      connection.close()
    }
  })

  it('preserves inferred inverse joins, construction-time casing, aliases and filters', () => {
    const table = sqlite.sqliteTableCreator(name => name, 'snake_case')
    const authors = table('authors', { id: sqlite.integer(), displayName: sqlite.text() })
    const posts = table('posts', {
      id: sqlite.integer(), authorId: sqlite.integer(), postTitle: sqlite.text(),
      active: sqlite.integer({ mode: 'boolean' }),
    })
    const relations = drizzle.defineRelations({ authors, posts }, r => ({
      authors: { posts: r.many.posts({ where: { active: true } }) },
      posts: { author: r.one.authors({ from: r.posts.authorId, to: r.authors.id }) },
    }))
    const interpret = createDrizzleInterpreter({ schema: { authors, posts, relations } })
    const child = new FieldCondition('eq', 'postTitle', 'A')
    expectSql(interpret(some('posts', child), 'authors', { alias: 'a' }), [
      'EXISTS (SELECT 1 FROM "posts" as "a_ucast_0" ',
      'WHERE ((("a"."id" = "a_ucast_0"."author_id") and ("a_ucast_0"."active" = ?))) ',
      'AND ("a_ucast_0"."post_title" = ?))',
    ].join(''), [1, 'A'])
    expectSql(interpret(new FieldCondition('eq', 'displayName', 'Ada'), 'authors'),
      '"authors"."display_name" = ?', ['Ada'])

    const connection = new Database(':memory:')
    try {
      connection.exec(`
        CREATE TABLE authors(id integer, display_name text);
        CREATE TABLE posts(id integer, author_id integer, post_title text, active integer);
        INSERT INTO authors VALUES (1,'Ada'), (2,'Bob'), (3,'Empty');
        INSERT INTO posts VALUES (1,1,'A',1), (2,1,'Outside',0), (3,2,'Outside',0);
      `)
      const db = betterSqlite3.drizzle({ client: connection })
      const names = (condition: Condition) => db.select().from(authors)
        .where(interpret(condition, 'authors')).all().map(row => row.displayName)
      expect(names(some('posts', new FieldCondition('eq', 'postTitle', 'Outside'))))
        .to.deep.equal([])
      expect(names(relation('none', 'posts', child))).to.deep.equal(['Bob', 'Empty'])
      expect(names(relation('every', 'posts', child))).to.deep.equal(['Ada', 'Bob', 'Empty'])
      const inverse = interpret(some('author', new FieldCondition('eq', 'displayName', 'Ada')), 'posts')
      expect(db.select().from(posts).where(inverse).all().map(row => row.id)).to.deep.equal([1, 2])
    } finally {
      connection.close()
    }
  })

  describe('relation metadata', () => {
    it('accepts repeated declarations and ignores unrelated schema exports', () => {
      const { users, posts, relations } = setupMetadata()
      const interpret = createDrizzleInterpreter({
        schema: {
          relations,
          repeated: relations,
          users,
          posts,
          empty: null,
          label: 'schema',
          unrelated: { empty: null, value: 1, tableOnly: { table: users } },
        },
      })

      expectSql(interpret(some('posts', new FieldCondition('eq', 'title', 'A')), 'users'),
        'EXISTS (SELECT 1 FROM "posts" as "users_ucast_0" WHERE ("users"."id" = "users_ucast_0"."user_id") AND ("users_ucast_0"."title" = ?))',
        ['A'])
    })

    it('rejects distinct declarations for the same schema key', () => {
      const { users, posts, relations } = setupMetadata()
      const other = drizzle.defineRelations({ users, posts })

      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations, other } }))
        .to.throw('Multiple relation declarations for "users"')
    })

    it('requires source schema keys to reference the declared table', () => {
      const { users, posts, relations } = setupMetadata()
      const otherUsers = sqlite.sqliteTable('other_users', { id: sqlite.integer() })

      expect(() => createDrizzleInterpreter({ schema: { renamed: users, posts, relations } }))
        .to.throw('Table "users" not found in schema')
      expect(() => createDrizzleInterpreter({ schema: { users: otherUsers, posts, relations } }))
        .to.throw('Table "users" not found in schema')
    })

    it('rejects non-native relation metadata', () => {
      const { users, posts, relations } = setupMetadata()
      const invalid = { users: { ...relations.users, relations: { posts: {} } } }

      expect(() => createDrizzleInterpreter({ schema: { users, posts, invalid } }))
        .to.throw('Unsupported metadata for relation "users.posts"')
    })

    it('requires native target tables matching their schema keys', () => {
      const { users, posts, relations } = setupMetadata()
      const otherPosts = sqlite.sqliteTable('other_posts', { id: sqlite.integer() })
      Object.assign(relations.users.relations.posts, { targetTable: null })

      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations } }))
        .to.throw('Unsupported metadata for relation "users.posts"')

      relations.users.relations.posts.targetTable = otherPosts
      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations } }))
        .to.throw('Unsupported metadata for relation "users.posts"')
    })

    it('rejects empty and mismatched direct column pairs', () => {
      const { users, posts, relations } = setupMetadata()
      const relation = relations.users.relations.posts
      relation.sourceColumns = []

      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations } }))
        .to.throw('Invalid column pairs for relation "posts"')

      relation.sourceColumns = [users.id]
      relation.targetColumns = []
      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations } }))
        .to.throw('Invalid column pairs for relation "posts"')
    })

    it('requires a native junction table and matching through column pairs', () => {
      const { users, posts } = setupMetadata()
      const links = sqlite.sqliteTable('links', {
        userId: sqlite.integer(), postId: sqlite.integer(),
      })
      const relations = drizzle.defineRelations({ users, posts, links }, r => ({
        users: {
          posts: r.many.posts({
            from: r.users.id.through(r.links.userId),
            to: r.posts.id.through(r.links.postId),
          }),
        },
      }))
      const relation = relations.users.relations.posts
      const through = relation.through!
      relation.throughTable = undefined

      expect(() => createDrizzleInterpreter({ schema: { users, posts, links, relations } }))
        .to.throw('Invalid column pairs for relation "posts"')

      relation.throughTable = links
      relation.through = { source: [], target: through.target }
      expect(() => createDrizzleInterpreter({ schema: { users, posts, links, relations } }))
        .to.throw('Invalid column pairs for relation "posts"')

      relation.through = { source: through.source, target: [] }
      expect(() => createDrizzleInterpreter({ schema: { users, posts, links, relations } }))
        .to.throw('Invalid column pairs for relation "posts"')
    })

    it('rejects junction tables from another dialect', () => {
      const { users, posts, relations } = setupMetadata()
      relations.users.relations.posts.throughTable = pg.pgTable('links', {
        userId: pg.integer(), postId: pg.integer(),
      })

      expect(() => createDrizzleInterpreter({ schema: { users, posts, relations } }))
        .to.throw('Cross-dialect relations are not supported')
    })

    it('reports unknown relations on tables without declarations', () => {
      const { users } = setupMetadata()
      const interpret = createDrizzleInterpreter({ schema: { users } })
      const interpretRelation = (name: string) =>
        interpret(some(name, new FieldCondition('eq', 'title', 'A')), 'users')

      expect(() => interpretRelation('posts'))
        .to.throw('Relation metadata for "users.posts" not found')
      expect(() => interpretRelation('constructor'))
        .to.throw('Relation metadata for "users.constructor" not found')
      expect(() => interpretRelation('__proto__'))
        .to.throw('Relation metadata for "users.__proto__" not found')
      expect(() => interpretRelation('toString'))
        .to.throw('Relation metadata for "users.toString" not found')
    })

    function setupMetadata() {
      const users = sqlite.sqliteTable('users', { id: sqlite.integer() })
      const posts = sqlite.sqliteTable('posts', {
        userId: sqlite.integer('user_id'), id: sqlite.integer(), title: sqlite.text(),
      })
      const relations = drizzle.defineRelations({ users, posts }, r => ({
        users: { posts: r.many.posts({ from: r.users.id, to: r.posts.userId }) },
      }))
      return { users, posts, relations }
    }
  })

  function setup(encoded: (name: string) => any) {
    const users = sqlite.sqliteTable('users', {
      id: sqlite.integer('id'),
      displayName: sqlite.text('display_name'),
      age: sqlite.integer('age'),
      active: sqlite.integer('active', { mode: 'boolean' }),
      createdAt: sqlite.integer('created_at', { mode: 'timestamp' }),
      code: encoded('code'),
      camelCase: sqlite.text(),
    })
    const userRelations = drizzle.defineRelations({ users })
    const schema = { users, userRelations }
    const interpret = createDrizzleInterpreter({ schema })
    const dialect = new sqlite.SQLiteDialect()
    const render = (condition: Condition) => dialect.sqlToQuery(interpret(condition, 'users'))

    return { schema, interpret, dialect, render }
  }
})

function setupRelations(tables: Record<string, any>, definitions: RelationDefinitions) {
  const relations = drizzle.defineRelations(tables, r => Object.fromEntries(
    Object.entries(definitions).map(([source, definitions]) => [source,
      Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
        const target = r[definition.kind || 'many'] as Record<
          string, (config: { from: any[]; to: any[] }) => any
        >
        return [name, target[definition.target]({
          from: definition.from.map(key => (r[source] as Record<string, any>)[key]),
          to: definition.to.map(key => (r[definition.target] as Record<string, any>)[key]),
        })]
      })),
    ]),
  ))
  return { ...tables, relations }
}

function relation(operator: string, name: string, predicate: Condition) {
  return new FieldCondition(operator, name, predicate)
}

function some(name: string, predicate: Condition) {
  return relation('some', name, predicate)
}

function expectSql(predicate: any, sql: string, params: unknown[]) {
  const query = new sqlite.SQLiteDialect().sqlToQuery(predicate)
  expect(query.sql).to.equal(sql)
  expect(query.params).to.deep.equal(params)
}
