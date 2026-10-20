import { CompoundCondition, FieldCondition } from '@ucast/core'
import { relations, sql } from 'drizzle-orm'
import { alias, integer, sqliteTable, SQLiteSyncDialect, text } from 'drizzle-orm/sqlite-core'
import { pgSchema, PgDialect, integer as pgInteger, text as pgText } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mysqlTable, int, varchar, MySqlDialect } from 'drizzle-orm/mysql-core'
// @ts-expect-error better-sqlite3 has no types
import Database from 'better-sqlite3'
import { createDrizzleInterpreter } from '../../src/lib/drizzle-orm/v0.x.ts'
import { expect } from '../specHelper.ts'
import { expectedRelationNames, namesOf, relationConditions, relationSeeds } from '../relationTestsConfig.ts'

describe('Drizzle v0.x relations', () => {
  const {
    users, profiles, projects, deadlines, roles, userRoles, userRelations,
    schema, interpret, dialect, matchingProject, manyToMany, render,
  } = setup()

  it('resolves inverse relations, maps columns, and preserves bound values', () => {
    const query = render(some('profile', new FieldCondition('eq', 'displayName', 'Alice Profile')))
    expect(query.sql).to.equal('EXISTS (SELECT 1 FROM "profiles" as "users_ucast_0" WHERE "users"."id" = "users_ucast_0"."user_id" AND "users_ucast_0"."display_name" = ?)')
    expect(query.params).to.deep.equal(['Alice Profile'])
  })

  it('reuses shared some, none, and every semantics', () => {
    for (const [operator, exists, predicate] of [
      ['some', 'EXISTS', '"users_ucast_0"."name" = ?'],
      ['none', 'NOT EXISTS', '"users_ucast_0"."name" = ?'],
      ['every', 'NOT EXISTS', 'NOT ("users_ucast_0"."name" = ?)'],
    ]) {
      expect(render(new FieldCondition(operator, 'projects', matchingProject)).sql)
        .to.equal(`${exists} (SELECT 1 FROM "projects" as "users_ucast_0" WHERE "users"."id" = "users_ucast_0"."user_id" AND ${predicate})`)
    }
  })

  it('uses each related column encoder', () => {
    expect(render(some('projects', new FieldCondition('in', 'active', [true, false]))).params)
      .to.deep.equal([1, 0])
  })

  it('allocates distinct aliases across nested and repeated relations and resets each call', () => {
    const nested = some('projects', some('deadlines', new FieldCondition('eq', 'date', '2026-07-01')))
    const query = render(new CompoundCondition('and', [nested, some('projects', matchingProject)]))
    expect(query.sql).to.contain('"users_ucast_0"."id" = "users_ucast_1"."project_id"')
    expect(query.sql).to.contain('"users"."id" = "users_ucast_2"."user_id"')
    expect(query.params).to.deep.equal(['2026-07-01', 'Audit'])
    expect(render(nested).sql).to.contain('"users_ucast_0"."id" = "users_ucast_1"."project_id"')
  })

  it('honors query aliases, including generated alias collisions', () => {
    const condition = some('projects', matchingProject)
    expect(render(condition, { alias: 'u' }).sql).to.contain('"u"."id" = "u_ucast_0"."user_id"')
    expect(render(condition, { alias: 'ucast_0' }).sql).to.contain('"ucast_0"."id" = "ucast_0_ucast_0"."user_id"')
  })

  it('shares metadata across duplicate table keys in any schema order', () => {
    const { userRelations: declarations, ...rest } = schema
    for (const source of [
      { ...schema, duplicate: users },
      { userRelations: declarations, duplicate: users, ...rest },
    ]) {
      const custom = createDrizzleInterpreter({ schema: source })
      expect(dialect.sqlToQuery(custom(some('projects', matchingProject), 'users')).sql)
        .to.contain('"users"."id" = "users_ucast_0"."user_id"')
    }
    const otherUsers = sqliteTable('users', { id: integer('id') })
    expect(() => createDrizzleInterpreter({ schema: { users, otherUsers } }))
      .to.throw('Multiple table definitions')
  })

  it('reports undeclared relation names during interpretation', () => {
    for (const name of ['missing', 'constructor', '__proto__', 'toString']) {
      expect(() => render(some(name, matchingProject))).to.throw('Relation metadata')
    }
  })

  it('rejects absent target tables and ambiguous inverse relations at factory creation', () => {
    expect(() => createDrizzleInterpreter({ schema: { users, userRelations } }))
      .to.throw('Table "projects" not found in schema')
    const usersProjects = relations(users, ({ many }) => ({ projects: many(projects) }))
    const ambiguous = relations(projects, ({ one }) => ({
      first: one(users, { fields: [projects.userId], references: [users.id] }),
      second: one(users, { fields: [projects.userId], references: [users.id] }),
    }))
    expect(() => createDrizzleInterpreter({
      schema: { users, projects, usersProjects, ambiguous },
    })).to.throw('multiple relations')
  })

  it('rejects cross-dialect joins and invalid column pairs at factory creation', () => {
    const foreign = pgSchema('app').table('foreign', { id: pgInteger() })
    const crossDialect = relations(users, ({ one }) => ({
      foreign: one(foreign, { fields: [users.id], references: [foreign.id] }),
    }))
    expect(() => createDrizzleInterpreter({ schema: { users, foreign, crossDialect } }))
      .to.throw('Cross-dialect relations are not supported')
    const empty = relations(users, ({ one }) => ({
      project: one(projects, { fields: [], references: [] } as any),
    }))
    expect(() => createDrizzleInterpreter({ schema: { users, projects, empty } }))
      .to.throw('Invalid column pairs for relation "project"')
    const mismatched = relations(users, ({ one }) => ({
      project: one(projects, { fields: [users.id], references: [] } as any),
    }))
    expect(() => createDrizzleInterpreter({ schema: { users, projects, mismatched } }))
      .to.throw('Invalid column pairs for relation "project"')
  })

  it('normalizes join columns at startup and reuses them across interpretations', () => {
    let reads = 0
    const declarations = relations(users, ({ one }) => ({
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
    const parent = sqliteTable('parent', { id: integer('id'), tenant: text('tenant') })
    const child = sqliteTable('child', {
      parentId: integer('parent_id'), tenant: text('tenant'), name: text('name').notNull(),
    })
    const parentRelations = relations(parent, ({ many }) => ({ children: many(child) }))
    const childRelations = relations(child, ({ one }) => ({
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
    const nodes = sqliteTable('nodes', { id: integer('id'), parentId: integer('parent_id'), name: text('name') })
    const nodeRelations = relations(nodes, ({ one, many }) => ({
      parent: one(nodes, { fields: [nodes.parentId], references: [nodes.id], relationName: 'tree' }),
      children: many(nodes, { relationName: 'tree' }),
    }))
    const custom = createDrizzleInterpreter({ schema: { nodes, nodeRelations } })
    const query = dialect.sqlToQuery(custom(some('children', some('parent', matchingProject)), 'nodes'))
    expect(query.sql).to.contain('"nodes"."id" = "nodes_ucast_0"."parent_id"')
    expect(query.sql).to.contain('"nodes_ucast_0"."parent_id" = "nodes_ucast_1"."id"')
  })

  it('preserves PostgreSQL schemas, render-time casing, and parameter ordering', () => {
    const app = pgSchema('app')
    const people = app.table('people', { personId: pgInteger(), displayName: pgText() })
    const items = app.table('items', { ownerId: pgInteger(), displayName: pgText() })
    const peopleRelations = relations(people, ({ many }) => ({ items: many(items) }))
    const itemRelations = relations(items, ({ one }) => ({
      owner: one(people, { fields: [items.ownerId], references: [people.personId] }),
    }))
    const custom = createDrizzleInterpreter({
      schema: { people, items, peopleRelations, itemRelations },
    })
    const predicate = custom(some('items', new FieldCondition('eq', 'displayName', 'A')), 'people')
    const query = new PgDialect({ casing: 'snake_case' }).sqlToQuery(sql`${1} AND ${predicate} AND ${2}`)
    expect(query.sql).to.contain('FROM "app"."items" as "people_ucast_0"')
    expect(query.sql).to.contain('"people"."person_id" = "people_ucast_0"."owner_id"')
    expect(query.sql).to.contain('"people_ucast_0"."display_name" = $2')
    expect(query.params).to.deep.equal([1, 'A', 2])
  })

  it('renders native MySQL relation columns and placeholders', () => {
    const parents = mysqlTable('parents', { id: int('id') })
    const children = mysqlTable('children', {
      parentId: int('parent_id'), name: varchar('name', { length: 50 }),
    })
    const parentRelations = relations(parents, ({ many }) => ({ children: many(children) }))
    const childRelations = relations(children, ({ one }) => ({
      parent: one(parents, { fields: [children.parentId], references: [parents.id] }),
    }))
    const custom = createDrizzleInterpreter({
      schema: { parents, children, parentRelations, childRelations },
    })
    const query = new MySqlDialect().sqlToQuery(
      custom(some('children', matchingProject), 'parents')
    )
    expect(query.sql).to.equal('EXISTS (SELECT 1 FROM `children` as `parents_ucast_0` WHERE `parents`.`id` = `parents_ucast_0`.`parent_id` AND `parents_ucast_0`.`name` = ?)')
    expect(query.params).to.deep.equal(['Audit'])
  })

  describe('e2e execution', () => {
    let connection: InstanceType<typeof Database>
    let db: ReturnType<typeof drizzle>
    beforeEach(() => {
      connection = new Database(':memory:')
      db = drizzle(connection)
      connection.exec(`
        CREATE TABLE users (id integer, tenant_id text, name text);
        CREATE TABLE profiles (id integer, user_id integer, display_name text);
        CREATE TABLE projects (id integer, user_id integer, name text, active integer);
        CREATE TABLE deadlines (id integer, project_id integer, date text);
        CREATE TABLE roles (id integer, name text, display_name text);
        CREATE TABLE user_roles (user_id integer, role_id integer);
      `)
      db.insert(users).values(relationSeeds.users).run()
      db.insert(profiles).values(relationSeeds.profiles).run()
      db.insert(projects).values(relationSeeds.projects).run()
      db.insert(deadlines).values(relationSeeds.deadlines).run()
      db.insert(roles).values(relationSeeds.roles).run()
      db.insert(userRoles).values(relationSeeds.userRoles).run()
    })
    afterEach(() => connection.close())

    for (const kind of ['hasMany', 'hasOne', 'belongsTo', 'manyToMany'] as const) {
      it(`filters ${kind} relations`, () => {
        const condition = kind === 'manyToMany' ? manyToMany : relationConditions[kind]
        const key = kind === 'belongsTo' ? 'projects' : 'users'
        const records = db.select().from(schema[key]).where(interpret(condition, key)).all()
        expect(namesOf(records)).to.deep.equal(expectedRelationNames[kind])
      })
    }

    it('filters nested relations and native root aliases', () => {
      const condition = some('projects', some('deadlines', new FieldCondition('eq', 'date', '2026-07-01')))
      const u = alias(users, 'u')
      expect(namesOf(db.select().from(u).where(interpret(condition, 'users', { alias: 'u' })).all()))
        .to.deep.equal(['Bob'])
    })

    it('implements none and vacuous every, including parents without children', () => {
      db.insert(users).values({ id: 4, name: 'Dave' }).run()
      expect(namesOf(db.select().from(users).where(interpret(new FieldCondition('none', 'projects', matchingProject), 'users')).all()))
        .to.deep.equal(['Alice', 'Carol', 'Dave'])
      expect(namesOf(db.select().from(users).where(interpret(new FieldCondition('every', 'projects', new FieldCondition('eq', 'active', true)), 'users')).all()))
        .to.deep.equal(['Bob', 'Dave'])
    })

    it('keeps shared every semantics for nullable predicates and unlinked children', () => {
      db.insert(projects).values([
        { id: 5, userId: 2, name: 'Unknown', active: null },
        { id: 6, userId: null, name: 'Orphan', active: false },
      ]).run()
      const condition = new FieldCondition('every', 'projects', new FieldCondition('eq', 'active', true))
      expect(namesOf(db.select().from(users).where(interpret(condition, 'users')).all()))
        .to.deep.equal(['Bob'])
      const inverse = some('user', new FieldCondition('eq', 'name', 'Bob'))
      expect(namesOf(db.select().from(projects).where(interpret(inverse, 'projects')).all()))
        .to.deep.equal(['Audit', 'Unknown'])
    })

    it('uses correlated relations in UPDATE and DELETE', () => {
      const predicate = interpret(some('projects', matchingProject), 'users')
      expect(db.update(users).set({ name: 'Changed' }).where(predicate).run().changes).to.equal(1)
      expect(db.delete(users).where(predicate).run().changes).to.equal(1)
      expect(namesOf(db.select().from(users).all())).to.deep.equal(['Alice', 'Carol'])
    })
  })
})

function some(field: string, predicate: FieldCondition) {
  return new FieldCondition('some', field, predicate)
}

function setup() {
  const users = sqliteTable('users', {
    id: integer('id'), tenantId: text('tenant_id'), name: text('name').notNull(),
  })
  const profiles = sqliteTable('profiles', {
    id: integer('id'), userId: integer('user_id'), displayName: text('display_name'),
  })
  const projects = sqliteTable('projects', {
    id: integer('id'), userId: integer('user_id'), name: text('name').notNull(),
    active: integer('active', { mode: 'boolean' }),
  })
  const deadlines = sqliteTable('deadlines', {
    id: integer('id'), projectId: integer('project_id'), date: text('date'),
  })
  const roles = sqliteTable('roles', {
    id: integer('id'), name: text('name').notNull(), displayName: text('display_name'),
  })
  const userRoles = sqliteTable('user_roles', { userId: integer('user_id'), roleId: integer('role_id') })
  const userRelations = relations(users, ({ many, one }) => ({
    projects: many(projects), profile: one(profiles), roles: many(userRoles),
  }))
  const projectRelations = relations(projects, ({ one, many }) => ({
    user: one(users, { fields: [projects.userId], references: [users.id] }),
    deadlines: many(deadlines),
  }))
  const profileRelations = relations(profiles, ({ one }) => ({
    user: one(users, { fields: [profiles.userId], references: [users.id] }),
  }))
  const deadlineRelations = relations(deadlines, ({ one }) => ({
    project: one(projects, { fields: [deadlines.projectId], references: [projects.id] }),
  }))
  const userRoleRelations = relations(userRoles, ({ one }) => ({
    user: one(users, { fields: [userRoles.userId], references: [users.id] }),
    role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
  }))
  const schema = {
    users, profiles, projects, deadlines, roles, userRoles,
    userRelations, projectRelations, profileRelations, deadlineRelations, userRoleRelations,
  }
  const interpret = createDrizzleInterpreter({ schema })
  const dialect = new SQLiteSyncDialect()
  const matchingProject = new FieldCondition('eq', 'name', 'Audit')
  // Drizzle 0.x represents many-to-many through two declared relation steps.
  const manyToMany = some('roles', some('role', new FieldCondition('eq', 'displayName', 'admin')))

  function render(condition: FieldCondition | CompoundCondition, options?: { alias: string }) {
    return dialect.sqlToQuery(interpret(condition, 'users', options))
  }
  return {
    users, profiles, projects, deadlines, roles, userRoles, userRelations, projectRelations,
    schema, interpret, dialect, matchingProject, manyToMany, render,
  }
}
