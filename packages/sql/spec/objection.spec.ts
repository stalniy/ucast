import { FieldCondition, CompoundCondition } from '@ucast/core'
import { Model, QueryBuilder, snakeCaseMappers } from 'objection'
import Knex from 'knex'
import { createInterpreter, getRelationMetadata, interpret } from '../src/lib/objection.ts'
import { expect } from './specHelper.ts'
import { eq, someRelation } from '../src/interpreters.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

describe('Condition interpreter for Objection', () => {
  const orm = configureORM()
  const { Project, User } = orm

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
      'select "users".* from "users" where EXISTS (SELECT 1 FROM "projects" as "projects_0" ' +
      'WHERE "users"."id" = "projects_0"."user_id" AND (EXISTS (SELECT 1 FROM "deadlines" as "deadlines_1" ' +
      'WHERE "projects_0"."id" = "deadlines_1"."project_id" AND ("deadlines_1"."date" = \'2026-06-28\'))))'
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

    expect(sql).to.contain('SELECT 1 FROM "user_roles" as "roles_')
    expect(sql).to.contain('_through" INNER JOIN "roles" as "roles_')
    expect(sql).to.contain('"."id" = "roles_')
    expect(sql).to.contain('_through"."role_id"')
    expect(sql).to.contain('"users"."id" = "roles_')
    expect(sql).to.contain('_through"."user_id"')
    expect(sql).to.contain('"."name" = \'admin\'')
  })

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = createInterpreter({ eq, some: someRelation }, {
      getRelationMetadata(relationName, ctx) {
        if (relationName !== 'projects') {
          return getRelationMetadata(relationName, ctx)
        }

        return {
          relationContext: Project,
          buildRelationQuery(relation) {
            const tenantProjectAlias = 'tenant_projects'
            const tenantProjectField = (field: string) => {
              return `${relation.escapeField(tenantProjectAlias)}.${relation.escapeField(field)}`
            }

            return `SELECT 1 FROM ${relation.escapeField('tenant_projects')} as ${relation.escapeField(tenantProjectAlias)}` +
            ` INNER JOIN ${relation.escapeField('projects')} as ${relation.escapeField(relation.relationAlias)}` +
            ` ON ${relation.relationField('id')} = ${tenantProjectField('project_id')}` +
            ` WHERE ${relation.parentField('tenant_id')} = ${tenantProjectField('tenant_id')}` +
            ` AND ${tenantProjectField('kind')} = ${relation.param('owned')}` +
            ` AND (${relation.conditionSql()})`
          }
        }
      }
    })
    const condition = new FieldCondition(
      'some',
      'projects',
      new FieldCondition('eq', 'active', true)
    )
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.contain('"tenant_projects"."kind" = \'owned\' AND (')
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
  })
})

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

  return { Deadline, Profile, Project, Role, User, UserRole }
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
  })
  await knex.schema.createTable('user_roles', table => {
    table.integer('user_id').notNullable().references('users.id')
    table.integer('role_id').notNullable().references('roles.id')
    table.primary(['user_id', 'role_id'])
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
