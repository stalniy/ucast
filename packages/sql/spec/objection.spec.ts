import { FieldCondition, CompoundCondition, buildAnd } from '@ucast/core'
import { Model, QueryBuilder, snakeCaseMappers } from 'objection'
import Knex from 'knex'
import { createObjectionInterpreter, objectionToSqlMetadata, interpret } from '../src/lib/objection.ts'
import { expect, linearize } from './specHelper.ts'
import { eq, someRelation } from '../src/interpreters.ts'
import { createDefaultSqlComposer } from '../src/interpreter.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

describe(createObjectionInterpreter.name, () => {
  const orm = configureORM()
  const { Project, User } = orm

  it('maps a model property through its configured column mapper', () => {
    const query = interpret(new FieldCondition('eq', 'displayName', 'Ada'), orm.Profile.query())
    expect(query.toKnexQuery().toString()).to.contain('"display_name" = \'Ada\'')
  })

  it('maps a model property to its configured database column for related models', () => {
    const query = interpret(
      buildAnd([
        new FieldCondition('eq', 'displayName', 'Alice Profile'),
        new FieldCondition('some', 'user', new FieldCondition('eq', 'tenantId', 1))
      ]),
      orm.Profile.query().alias('p'),
    ).toKnexQuery().toSQL()

    expect(query.sql).to.equal(linearize`
      select "p".* from "profiles" as "p"
      where ("p"."display_name" = ? and EXISTS (
        SELECT 1
        FROM "users" as "user_ucast0"
        WHERE "p"."user_id" = "user_ucast0"."id" AND "user_ucast0"."tenant_id" = ?
      ))
    `)
    expect(query.bindings).to.eql(['Alice Profile', 1])
  })

  it('rejects scalar properties that the model formatter expands into multiple columns', () => {
    class MultiColumnModel extends Model {
      static tableName = 'multi_columns'

      $formatDatabaseJson(json: Record<string, unknown>) {
        if (Object.prototype.hasOwnProperty.call(json, 'combined')) {
          return { first_name: json.combined, last_name: json.combined }
        }
        return super.$formatDatabaseJson(json)
      }
    }

    expect(() => interpret(new FieldCondition('eq', 'combined', 'value'), MultiColumnModel.query()))
      .to.throw('maps to multiple database columns')
  })

  it('reports unknown relations through the shared metadata boundary', () => {
    expect(() => interpret(
      new FieldCondition('some', 'missing', new FieldCondition('eq', 'name', 'test')),
      User.query(),
    )).to.throw('Relation metadata for "users.missing" not found')
  })

  it('returns `QueryBuilder`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, User.query())

    expect(query).to.be.instanceOf(QueryBuilder)
  })

  it('properly binds parameters', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where "users"."name" = 'test'
    `.trim())
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where "users"."age" in(1, 2, 3)
    `.trim())
  })

  it('treats dotted field names as literal fields', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where "users"."projects.name" = 'test'
    `.trim())
  })

  it("doesn't auto join dotted fields in compound conditions", () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])

    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where ("users"."projects.name" = 'test' and "users"."projects.active" = true)
    `.trim())
  })

  it('generates nested EXISTS queries for nested relations', () => {
    const condition = new FieldCondition(
      'some',
      'projects',
      new FieldCondition(
        'some',
        'deadlines',
        new FieldCondition('eq', 'date', '2026-06-28')
      )
    )
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(
      'select "users".* from "users" where EXISTS (SELECT 1 FROM "projects" as "projects_ucast0" ' +
      'WHERE "users"."id" = "projects_ucast0"."user_id" AND EXISTS (SELECT 1 FROM "deadlines" as "deadlines_ucast1" ' +
      'WHERE "projects_ucast0"."id" = "deadlines_ucast1"."project_id" AND "deadlines_ucast1"."date" = \'2026-06-28\'))'
    )
  })

  it('uses the through table for many-to-many relations', () => {
    const condition = new FieldCondition(
      'some',
      'roles',
      new FieldCondition('eq', 'name', 'admin')
    )
    const query = interpret(condition, User.query())
    const sql = query.toKnexQuery().toString()

    expect(sql).to.contain('SELECT 1 FROM "roles" as "roles_')
    expect(sql).to.contain('INNER JOIN "user_roles" as "roles_ucast0_through"')
    expect(sql).to.contain('"."id" = "roles_')
    expect(sql).to.contain('_through"."role_id"')
    expect(sql).to.contain('"users"."id" = "roles_')
    expect(sql).to.contain('_through"."user_id"')
    expect(sql).to.contain('"."name" = \'admin\'')
  })

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = createDomainInterpreter(Project)
    const condition = new FieldCondition(
      'some',
      'projects',
      new FieldCondition('eq', 'active', true)
    )
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.contain('"tenant_projects"."kind" = \'owned\'')
    expect(query.toKnexQuery().toString()).to.contain('"."active" = true')
  })

  describe('SQLite relation e2e', () => {
    let knex: ReturnType<typeof Knex>

    before(async () => {
      knex = Knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
      })
      Model.knex(knex)
      await createObjectionSchema(knex)
      await seedObjection(orm)
    })

    after(async () => {
      await knex.destroy()
    })

    it('executes mapped root properties together with mapped related properties and aliases', async () => {
      const profiles = await interpret(
        buildAnd([
          new FieldCondition('eq', 'displayName', 'Alice Profile'),
          new FieldCondition('some', 'user', new FieldCondition('eq', 'tenantId', 'tenant-a')),
        ]),
        orm.Profile.query().alias('p'),
      )

      expect(profiles.map(profile => profile.displayName)).to.deep.equal(['Alice Profile'])
    })

    it('executes nested relation conditions with shared parameter bindings', async () => {
      const users = await interpret(
        buildAnd([
          new FieldCondition('eq', 'tenantId', 'tenant-a'),
          new FieldCondition('some', 'projects', new FieldCondition(
            'some', 'deadlines', new FieldCondition('eq', 'date', '2026-06-28'),
          )),
        ]),
        User.query().alias('u'),
      )

      expect(namesOf(users)).to.deep.equal(['Alice'])
    })

    it('filters HasMany relations', async () => {
      const users = await interpret(relationConditions.hasMany, User.query()).orderBy('name')

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasMany)
    })

    it('filters BelongsToOne relations', async () => {
      const projects = await interpret(relationConditions.belongsTo, Project.query()).orderBy('name')

      expect(namesOf(projects)).to.deep.equal(expectedRelationNames.belongsTo)
    })

    it('filters HasOne relations', async () => {
      const users = await interpret(relationConditions.hasOne, User.query()).orderBy('name')

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasOne)
    })

    it('filters ManyToMany relations', async () => {
      const users = await interpret(relationConditions.manyToMany, User.query()).orderBy('name')

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.manyToMany)
    })

    it('executes custom composer domain joins with additional parameters', async () => {
      await knex.schema.createTable('tenant_projects', table => {
        table.string('tenant_id').notNullable()
        table.integer('project_id').notNullable()
        table.string('kind').notNullable()
      })
      await knex('tenant_projects').insert([
        { tenant_id: 'tenant-a', project_id: 1, kind: 'owned' },
        { tenant_id: 'tenant-b', project_id: 3, kind: 'shared' },
      ])
      const interpret = createDomainInterpreter(Project)
      const users = await interpret(
        new FieldCondition('some', 'projects', new FieldCondition('eq', 'active', true)),
        User.query().alias('u'),
      )

      expect(namesOf(users)).to.deep.equal(['Alice', 'Bob'])
    })

    it('requires both composite relation keys when filtering mapped child properties', async () => {
      const { CompositeParent } = orm
      await CompositeParent.query().insertGraph([
        { id: 1, tenantId: 'tenant-a', name: 'both keys' },
      ])
      await knex('composite_children').insert([
        { id: 1, parent_tenant_id: 'tenant-a', parent_id: 1, display_name: 'selected' },
        { id: 2, parent_tenant_id: 'tenant-b', parent_id: 1, display_name: 'one key only' },
        { id: 3, parent_tenant_id: 'tenant-a', parent_id: 2, display_name: 'one key only' },
      ])
      const result = await interpret(
        new FieldCondition(
          'some',
          'children',
          new FieldCondition('eq', 'displayName', 'selected'),
        ),
        CompositeParent.query(),
      ).orderBy('name')
      const decoyResult = await interpret(
        new FieldCondition(
          'some',
          'children',
          new FieldCondition('eq', 'displayName', 'one key only'),
        ),
        CompositeParent.query(),
      )

      expect(result.map(parent => parent.name)).to.deep.equal(['both keys'])
      expect(decoyResult).to.have.length(0)
    })
  })
})

function createDomainInterpreter(Project: typeof Model) {
  return createObjectionInterpreter({ eq, some: someRelation }, {
    createSqlComposer(options) {
      const composer = createDefaultSqlComposer(options)
      return {
        ...composer,
        relation(name) {
          if (name !== 'projects') return composer.relation(name)
          const relationAlias = 'domain_projects'
          const child = createDefaultSqlComposer({
            ...options,
            alias: relationAlias,
            metadata: objectionToSqlMetadata(Project),
          }, composer)
          const tenantProjectField = (field: string) => {
            return `${options.escapeIdentifier('tenant_projects')}.${options.escapeIdentifier(field)}`
          }

          return {
            composer: child,
            subquery(predicate) {
              return `SELECT 1 FROM ${options.escapeIdentifier('tenant_projects')} as ${options.escapeIdentifier('tenant_projects')}` +
                ` INNER JOIN ${options.escapeIdentifier('projects')} as ${options.escapeIdentifier(relationAlias)}` +
                ` ON ${child.field('id')} = ${tenantProjectField('project_id')}` +
                ` WHERE ${composer.field('tenantId')} = ${tenantProjectField('tenant_id')}` +
                ` AND (${predicate})` +
                ` AND ${tenantProjectField('kind')} = ${composer.param('owned')}`
            }
          }
        }
      }
    }
  })
}

function configureORM() {
  Model.knex(Knex({ client: 'pg' }))

  class BaseModel extends Model {
    static columnNameMappers = snakeCaseMappers()
  }

  class User extends BaseModel {
    static tableName = 'users'
    name!: string

    static get relationMappings() {
      return {
        projects: {
          relation: Model.HasManyRelation,
          modelClass: Project,
          join: { from: 'users.id', to: 'projects.user_id' }
        },
        profile: {
          relation: Model.HasOneRelation,
          modelClass: Profile,
          join: { from: 'users.id', to: 'profiles.user_id' }
        },
        roles: {
          relation: Model.ManyToManyRelation,
          modelClass: Role,
          join: {
            from: 'users.id',
            through: {
              from: 'user_roles.user_id',
              to: 'user_roles.role_id'
            },
            to: 'roles.id'
          }
        }
      }
    }
  }

  class Profile extends BaseModel {
    static tableName = 'profiles'
    displayName!: string

    static get relationMappings() {
      return {
        user: {
          relation: Model.BelongsToOneRelation,
          modelClass: User,
          join: { from: 'profiles.user_id', to: 'users.id' }
        }
      }
    }
  }

  class Project extends BaseModel {
    static tableName = 'projects'
    name!: string

    static get relationMappings() {
      return {
        user: {
          relation: Model.BelongsToOneRelation,
          modelClass: User,
          join: { from: 'projects.user_id', to: 'users.id' },
          active: Boolean
        },
        deadlines: {
          relation: Model.HasManyRelation,
          modelClass: Deadline,
          join: { from: 'projects.id', to: 'deadlines.project_id' }
        }
      }
    }
  }

  class Deadline extends BaseModel {
    static tableName = 'deadlines'

    static get relationMappings() {
      return {
        project: {
          relation: Model.BelongsToOneRelation,
          modelClass: Project,
          join: { from: 'deadlines.project_id', to: 'projects.id' }
        }
      }
    }
  }

  class Role extends BaseModel {
    static tableName = 'roles'
    displayName!: string

    static get relationMappings() {
      return {
        users: {
          relation: Model.ManyToManyRelation,
          modelClass: User,
          join: {
            from: 'roles.id',
            through: {
              from: 'user_roles.role_id',
              to: 'user_roles.user_id'
            },
            to: 'users.id'
          }
        }
      }
    }
  }

  class UserRole extends BaseModel {
    static tableName = 'user_roles'
  }

  class CompositeParent extends BaseModel {
    static tableName = 'composite_parents'
    id!: number
    tenantId!: string
    name!: string

    static get relationMappings() {
      return {
        children: {
          relation: Model.HasManyRelation,
          modelClass: CompositeChild,
          join: {
            from: ['composite_parents.tenant_id', 'composite_parents.id'],
            to: ['composite_children.parent_tenant_id', 'composite_children.parent_id'],
          },
        },
      }
    }
  }

  class CompositeChild extends BaseModel {
    static tableName = 'composite_children'
    displayName!: string
  }

  return { CompositeParent, Deadline, Profile, Project, Role, User, UserRole }
}

async function createObjectionSchema(knex: ReturnType<typeof Knex>) {
  await knex.schema.createTable('users', table => {
    table.integer('id').primary()
    table.string('tenant_id').notNullable()
    table.string('name').notNullable()
  })
  await knex.schema.createTable('profiles', table => {
    table.integer('id').primary()
    table.integer('user_id').notNullable().references('users.id')
    table.string('display_name').notNullable()
  })
  await knex.schema.createTable('projects', table => {
    table.integer('id').primary()
    table.integer('user_id').notNullable().references('users.id')
    table.string('name').notNullable()
    table.boolean('active').notNullable()
  })
  await knex.schema.createTable('deadlines', table => {
    table.integer('id').primary()
    table.integer('project_id').notNullable().references('projects.id')
    table.string('date').notNullable()
  })
  await knex.schema.createTable('roles', table => {
    table.integer('id').primary()
    table.string('name').notNullable()
    table.string('display_name').notNullable()
  })
  await knex.schema.createTable('user_roles', table => {
    table.integer('user_id').notNullable().references('users.id')
    table.integer('role_id').notNullable().references('roles.id')
    table.primary(['user_id', 'role_id'])
  })
  await knex.schema.createTable('composite_parents', table => {
    table.integer('id').notNullable()
    table.string('tenant_id').notNullable()
    table.string('name').notNullable()
    table.primary(['tenant_id', 'id'])
  })
  await knex.schema.createTable('composite_children', table => {
    table.integer('id').primary()
    table.string('parent_tenant_id').notNullable()
    table.integer('parent_id').notNullable()
    table.string('display_name').notNullable()
  })
}

async function seedObjection({
  Deadline,
  Profile,
  Project,
  Role,
  User,
  UserRole,
}: ReturnType<typeof configureORM>) {
  for (const user of relationSeeds.users) {
    await User.query().insert(user)
  }
  for (const profile of relationSeeds.profiles) {
    await Profile.query().insert(profile)
  }
  for (const project of relationSeeds.projects) {
    await Project.query().insert(project)
  }
  for (const deadline of relationSeeds.deadlines) {
    await Deadline.query().insert(deadline)
  }
  for (const role of relationSeeds.roles) {
    await Role.query().insert(role)
  }
  for (const userRole of relationSeeds.userRoles) {
    await UserRole.query().insert(userRole)
  }
}
