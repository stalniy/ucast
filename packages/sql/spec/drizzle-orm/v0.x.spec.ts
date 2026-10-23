import { FieldCondition, type Condition } from '@ucast/core'
import * as drizzle from 'drizzle-orm-v0'
import * as sqlite from 'drizzle-orm-v0/sqlite-core'
import * as pg from 'drizzle-orm-v0/pg-core'
import * as mysql from 'drizzle-orm-v0/mysql-core'
import * as aliases from 'drizzle-orm-v0/alias'
import * as betterSqlite3 from 'drizzle-orm-v0/better-sqlite3'
import { createDrizzleInterpreter } from '../../src/lib/drizzle-orm/v0.x.ts'
import { includeDrizzleInterpreterExamples, type RelationDefinitions } from './sharedExamples.ts'
import { expect } from '../specHelper.ts'

describe(`${createDrizzleInterpreter.name} v0.x`, () => {
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

  it('supports native column casing at render time', () => {
    const users = sqlite.sqliteTable('users', { camelCase: sqlite.text() })
    const interpret = createDrizzleInterpreter({ schema: { users } })
    const predicate = interpret(new FieldCondition('eq', 'camelCase', 'A'), 'users')
    const dialect = new sqlite.SQLiteSyncDialect()

    expect(dialect.sqlToQuery(predicate).sql).to.equal('"users"."camelCase" = ?')
    const query = new sqlite.SQLiteSyncDialect({ casing: 'snake_case' }).sqlToQuery(predicate)
    expect(query.sql).to.equal('"users"."camel_case" = ?')
    expect(query.params).to.deep.equal(['A'])
    expect(dialect.sqlToQuery(predicate).sql).to.equal('"users"."camelCase" = ?')
  })

  describe('relation metadata', () => {
    it('resolves inverse relations, maps columns, and preserves bound values', () => {
      const { render } = setupRelations()
      const query = render(some('profile', new FieldCondition('eq', 'displayName', 'Alice Profile')))
      expect(query.sql).to.equal('EXISTS (SELECT 1 FROM "profiles" as "users_ucast_0" WHERE ("users"."id" = "users_ucast_0"."user_id") AND ("users_ucast_0"."display_name" = ?))')
      expect(query.params).to.deep.equal(['Alice Profile'])
    })

    it('uses each related column encoder', () => {
      const { render } = setupRelations()
      expect(render(some('projects', new FieldCondition('in', 'active', [true, false]))).params)
        .to.deep.equal([1, 0])
    })

    it('honors query aliases, including generated alias collisions', () => {
      const { render, matchingProject } = setupRelations()
      const condition = some('projects', matchingProject)
      expect(render(condition, { alias: 'u' }).sql).to.contain('"u"."id" = "u_ucast_0"."user_id"')
      expect(render(condition, { alias: 'ucast_0' }).sql).to.contain('"ucast_0"."id" = "ucast_0_ucast_0"."user_id"')
    })

    it('shares metadata across duplicate table keys in any schema order', () => {
      const { schema, users, dialect, matchingProject } = setupRelations()
      const { userRelations: declarations, ...rest } = schema
      for (const source of [
        { ...schema, duplicate: users },
        { userRelations: declarations, duplicate: users, ...rest },
      ]) {
        const custom = createDrizzleInterpreter({ schema: source })
        expect(dialect.sqlToQuery(custom(some('projects', matchingProject), 'users')).sql)
          .to.contain('"users"."id" = "users_ucast_0"."user_id"')
      }
      const otherUsers = sqlite.sqliteTable('users', { id: sqlite.integer('id') })
      expect(() => createDrizzleInterpreter({ schema: { users, otherUsers } }))
        .to.throw('Multiple table definitions')
    })

    it('reports undeclared relation names during interpretation', () => {
      const { render, matchingProject } = setupRelations()
      for (const name of ['missing', 'constructor', '__proto__', 'toString']) {
        expect(() => render(some(name, matchingProject))).to.throw('Relation metadata')
      }
    })

    it('rejects ambiguous inverse relations at factory creation', () => {
      const { users, projects } = setupRelations()
      const usersProjects = drizzle.relations(users, ({ many }) => ({ projects: many(projects) }))
      const ambiguous = drizzle.relations(projects, ({ one }) => ({
        first: one(users, { fields: [projects.userId], references: [users.id] }),
        second: one(users, { fields: [projects.userId], references: [users.id] }),
      }))
      expect(() => createDrizzleInterpreter({
        schema: { users, projects, usersProjects, ambiguous },
      })).to.throw('multiple relations')
    })

    it('rejects empty and mismatched native column pairs', () => {
      const { users, projects } = setupRelations()
      const empty = drizzle.relations(users, ({ one }) => ({
        project: one(projects, { fields: [], references: [] } as any),
      }))
      expect(() => createDrizzleInterpreter({ schema: { users, projects, empty } }))
        .to.throw('Invalid column pairs for relation "project"')
      const mismatched = drizzle.relations(users, ({ one }) => ({
        project: one(projects, { fields: [users.id], references: [] } as any),
      }))
      expect(() => createDrizzleInterpreter({ schema: { users, projects, mismatched } }))
        .to.throw('Invalid column pairs for relation "project"')
    })

    it('normalizes join columns at startup and reuses them across interpretations', () => {
      const { users, projects, dialect, matchingProject } = setupRelations()
      let reads = 0
      const declarations = drizzle.relations(users, ({ one }) => ({
        project: one(projects, {
          get fields() {
            reads++
            return [users.id] as [typeof users.id]
          },
          references: [projects.id],
        }),
      }))
      const custom = createDrizzleInterpreter({ schema: { users, projects, declarations } })
      const startupReads = reads
      expect(startupReads).to.be.greaterThan(0)
      const condition = some('project', matchingProject)
      for (let index = 0; index < 2; index++) {
        const query = dialect.sqlToQuery(custom(condition, 'users'))
        expect(query.sql).to.contain('"users"."id" = "users_ucast_0"."id"')
        expect(query.params).to.deep.equal(['Audit'])
      }
      expect(reads).to.equal(startupReads)
    })

    it('joins every composite-key column', () => {
      const { dialect, matchingProject } = setupRelations()
      const parent = sqlite.sqliteTable('parent', { id: sqlite.integer('id'), tenant: sqlite.text('tenant') })
      const child = sqlite.sqliteTable('child', {
        parentId: sqlite.integer('parent_id'), tenant: sqlite.text('tenant'), name: sqlite.text('name').notNull(),
      })
      const parentRelations = drizzle.relations(parent, ({ many }) => ({ children: many(child) }))
      const childRelations = drizzle.relations(child, ({ one }) => ({
        parent: one(parent, {
          fields: [child.parentId, child.tenant], references: [parent.id, parent.tenant],
        }),
      }))
      const custom = createDrizzleInterpreter({
        schema: { parent, child, parentRelations, childRelations },
      })
      expect(dialect.sqlToQuery(custom(some('children', matchingProject), 'parent')).sql)
        .to.contain('"parent"."id" = "parent_ucast_0"."parent_id" AND "parent"."tenant" = "parent_ucast_0"."tenant"')
    })

    it('resolves named self relations without alias shadowing', () => {
      const { dialect, matchingProject } = setupRelations()
      const nodes = sqlite.sqliteTable('nodes', { id: sqlite.integer('id'), parentId: sqlite.integer('parent_id'), name: sqlite.text('name') })
      const nodeRelations = drizzle.relations(nodes, ({ one, many }) => ({
        parent: one(nodes, { fields: [nodes.parentId], references: [nodes.id], relationName: 'tree' }),
        children: many(nodes, { relationName: 'tree' }),
      }))
      const custom = createDrizzleInterpreter({ schema: { nodes, nodeRelations } })
      const query = dialect.sqlToQuery(custom(some('children', some('parent', matchingProject)), 'nodes'))
      expect(query.sql).to.contain('"nodes"."id" = "nodes_ucast_0"."parent_id"')
      expect(query.sql).to.contain('"nodes_ucast_0"."parent_id" = "nodes_ucast_1"."id"')
    })

    it('preserves PostgreSQL schemas, render-time casing, and parameter ordering', () => {
      const app = pg.pgSchema('app')
      const people = app.table('people', { personId: pg.integer(), displayName: pg.text() })
      const items = app.table('items', { ownerId: pg.integer(), displayName: pg.text() })
      const peopleRelations = drizzle.relations(people, ({ many }) => ({ items: many(items) }))
      const itemRelations = drizzle.relations(items, ({ one }) => ({
        owner: one(people, { fields: [items.ownerId], references: [people.personId] }),
      }))
      const custom = createDrizzleInterpreter({
        schema: { people, items, peopleRelations, itemRelations },
      })
      const predicate = custom(some('items', new FieldCondition('eq', 'displayName', 'A')), 'people')
      const query = new pg.PgDialect({ casing: 'snake_case' }).sqlToQuery(drizzle.sql`${1} AND ${predicate} AND ${2}`)
      expect(query.sql).to.contain('FROM "app"."items" as "people_ucast_0"')
      expect(query.sql).to.contain('"people"."person_id" = "people_ucast_0"."owner_id"')
      expect(query.sql).to.contain('"people_ucast_0"."display_name" = $2')
      expect(query.params).to.deep.equal([1, 'A', 2])
    })

    function setupRelations() {
      const users = sqlite.sqliteTable('users', { id: sqlite.integer('id') })
      const profiles = sqlite.sqliteTable('profiles', {
        userId: sqlite.integer('user_id'), displayName: sqlite.text('display_name'),
      })
      const projects = sqlite.sqliteTable('projects', {
        id: sqlite.integer('id'), userId: sqlite.integer('user_id'), name: sqlite.text('name'),
        active: sqlite.integer('active', { mode: 'boolean' }),
      })
      // Both inverse relations omit join columns; v0 infers them from the owning side.
      const userRelations = drizzle.relations(users, ({ many, one }) => ({
        projects: many(projects), profile: one(profiles),
      }))
      const projectRelations = drizzle.relations(projects, ({ one }) => ({
        user: one(users, { fields: [projects.userId], references: [users.id] }),
      }))
      const profileRelations = drizzle.relations(profiles, ({ one }) => ({
        user: one(users, { fields: [profiles.userId], references: [users.id] }),
      }))
      const schema = {
        users, projects, profiles, userRelations, projectRelations, profileRelations,
      }
      const interpret = createDrizzleInterpreter({ schema })
      const dialect = new sqlite.SQLiteSyncDialect()
      const matchingProject = new FieldCondition('eq', 'name', 'Audit')
      const render = (condition: FieldCondition, options?: { alias: string }) =>
        dialect.sqlToQuery(interpret(condition, 'users', options))

      return { users, projects, schema, dialect, matchingProject, render }
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
    const userRelations = drizzle.relations(users, () => ({}))
    const schema = { users, userRelations }
    const interpret = createDrizzleInterpreter({ schema })
    const dialect = new sqlite.SQLiteSyncDialect()
    const render = (condition: Condition) => dialect.sqlToQuery(interpret(condition, 'users'))

    return { schema, interpret, dialect, render }
  }
})

function setupRelations(tables: Record<string, any>, definitions: RelationDefinitions) {
  const declarations = Object.entries(definitions).map(([source, definitions]) =>
    drizzle.relations(tables[source], ({ one }) => Object.fromEntries(
      Object.entries(definitions).map(([name, definition]) => [name,
        one(tables[definition.target], {
          fields: definition.from.map(key => tables[source][key]) as [
            drizzle.AnyColumn, ...drizzle.AnyColumn[]
          ],
          references: definition.to.map(key => tables[definition.target][key]) as [
            drizzle.AnyColumn, ...drizzle.AnyColumn[]
          ],
        }),
      ]),
    )),
  )
  return { ...tables, ...Object.fromEntries(declarations.map((declaration, index) => [
    `relations${index}`, declaration,
  ])) }
}

function some(field: string, predicate: FieldCondition) {
  return new FieldCondition('some', field, predicate)
}
