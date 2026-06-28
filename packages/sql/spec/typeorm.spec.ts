import { FieldCondition } from '@ucast/core'
import {
  EntitySchema,
  createConnection,
  SelectQueryBuilder
} from 'typeorm'
import { createInterpreter, getRelationMetadata, interpret } from '../src/lib/typeorm.ts'
import { expect } from './specHelper.ts'
import { eq, someRelation } from '../src/interpreters.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

type Depromisify<T extends Promise<any>> = T extends Promise<infer A> ? A : never
type OrmContext = Depromisify<ReturnType<typeof configureORM>>

describe('Condition interpreter for TypeORM', () => {
  let conn: OrmContext['conn']
  let User: OrmContext['User']
  let Project: OrmContext['Project']

  before(async () => {
    const ctx = await configureORM()
    conn = ctx.conn
    User = ctx.User
    Project = ctx.Project
  })

  after(async () => {
    await conn.close()
  })

  it('returns a `SelectQueryBuilder<T>`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query).to.be.instanceof(SelectQueryBuilder)
    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenantId" AS "u_tenantId", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."name" = :0'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test' })
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenantId" AS "u_tenantId", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."age" in(:0, :1, :2)'
    ].join(' '))

    expect(query.getParameters()).to.eql({
      0: 1,
      1: 2,
      2: 3
    })
  })

  it('treats dotted field names as literal fields', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenantId" AS "u_tenantId", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."projects.name" = :0'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test' })
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
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenantId" AS "u_tenantId", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE EXISTS (' +
        'SELECT 1 FROM "project" as "projects_0"',
        'WHERE "u"."id" = "projects_0"."userId"',
        'AND (EXISTS (' +
          'SELECT 1 FROM "deadline" as "deadlines_1"',
          'WHERE "projects_0"."id" = "deadlines_1"."projectId"',
          'AND ("deadlines_1"."date" = :0)' +
        '))' +
      ')'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: '2026-06-28' })
  })

  it('uses the through table for many-to-many relations', () => {
    const condition = new FieldCondition(
      'some',
      'roles',
      new FieldCondition('eq', 'name', 'admin')
    )
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))
    const sql = query.getQuery()

    expect(sql).to.contain('SELECT 1 FROM "user_roles" as "roles_')
    expect(sql).to.contain('_through" INNER JOIN "role" as "roles_')
    expect(sql).to.contain('"."id" = "roles_')
    expect(sql).to.contain('_through"."roleId"')
    expect(sql).to.contain('"u"."id" = "roles_')
    expect(sql).to.contain('_through"."userId"')
    expect(sql).to.contain('"."name" = :0')
    expect(query.getParameters()).to.eql({ 0: 'admin' })
  })

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = createInterpreter({ eq, some: someRelation }, {
      getRelationMetadata(relationName, ctx) {
        if (relationName !== 'projects') {
          return getRelationMetadata(relationName, ctx)
        }

        return {
          relationContext: conn.getMetadata(Project),
          buildRelationQuery(relation) {
            const tenantProjectAlias = 'tenant_projects'
            const tenantProjectField = (field: string) => {
              return `${relation.escapeField(tenantProjectAlias)}.${relation.escapeField(field)}`
            }

            return `SELECT 1 FROM ${relation.escapeField('tenant_projects')} as ${relation.escapeField(tenantProjectAlias)}` +
            ` INNER JOIN ${relation.escapeField('project')} as ${relation.escapeField(relation.relationAlias)}` +
            ` ON ${relation.relationField('id')} = ${tenantProjectField('projectId')}` +
            ` WHERE ${relation.parentField('tenantId')} = ${tenantProjectField('tenantId')}` +
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
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.contain('"tenant_projects"."kind" = :0 AND (')
    expect(query.getQuery()).to.contain('"."active" = :1')
    expect(query.getParameters()).to.eql({ 0: 'owned', 1: true })
  })

  describe('SQLite relation e2e', () => {
    before(async () => {
      await seedTypeOrm(conn)
    })

    it('filters one-to-many relations', async () => {
      const users = await interpret(
        relationConditions.hasMany,
        conn.createQueryBuilder(User, 'u')
      ).orderBy('u.name', 'ASC').getMany()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasMany)
    })

    it('filters many-to-one relations', async () => {
      const projects = await interpret(
        relationConditions.belongsTo,
        conn.createQueryBuilder(Project, 'p')
      ).orderBy('p.name', 'ASC').getMany()

      expect(namesOf(projects)).to.deep.equal(expectedRelationNames.belongsTo)
    })

    it('filters one-to-one relations', async () => {
      const users = await interpret(
        relationConditions.hasOne,
        conn.createQueryBuilder(User, 'u')
      ).orderBy('u.name', 'ASC').getMany()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasOne)
    })

    it('filters many-to-many relations', async () => {
      const users = await interpret(
        relationConditions.manyToMany,
        conn.createQueryBuilder(User, 'u')
      ).orderBy('u.name', 'ASC').getMany()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.manyToMany)
    })
  })
})

async function configureORM() {
  class User {
    id!: number
    tenantId!: string
    name!: string
    profile!: Profile
    projects!: Project[]
    roles!: Role[]
  }

  class Profile {
    id!: number
    displayName!: string
    user!: User
  }

  class Project {
    id!: number
    name!: string
    user!: User
    active!: boolean
    deadlines!: Deadline[]
  }

  class Deadline {
    id!: number
    date!: string
    project!: Project
  }

  class Role {
    id!: number
    name!: string
    users!: User[]
  }

  const UserSchema = new EntitySchema<User>({
    name: 'User',
    target: User,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      tenantId: { type: 'varchar' },
      name: { type: 'varchar' },
    },
    relations: {
      profile: {
        target: 'Profile',
        type: 'one-to-one',
        inverseSide: 'user'
      },
      projects: {
        target: 'Project',
        type: 'one-to-many',
        inverseSide: 'user'
      },
      roles: {
        target: 'Role',
        type: 'many-to-many',
        joinTable: { name: 'user_roles' },
        inverseSide: 'users'
      }
    }
  })

  const ProfileSchema = new EntitySchema<Profile>({
    name: 'Profile',
    target: Profile,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      displayName: { type: 'varchar', name: 'display_name' }
    },
    relations: {
      user: {
        target: 'User',
        type: 'one-to-one',
        joinColumn: { name: 'userId' }
      }
    }
  })

  const ProjectSchema = new EntitySchema<Project>({
    name: 'Project',
    target: Project,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      name: { type: 'varchar' },
      active: { type: 'boolean' }
    },
    relations: {
      user: { target: 'User', type: 'many-to-one' },
      deadlines: {
        target: 'Deadline',
        type: 'one-to-many',
        inverseSide: 'project'
      }
    }
  })

  const DeadlineSchema = new EntitySchema<Deadline>({
    name: 'Deadline',
    target: Deadline,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      date: { type: 'varchar' }
    },
    relations: {
      project: { target: 'Project', type: 'many-to-one' }
    }
  })

  const RoleSchema = new EntitySchema<Role>({
    name: 'Role',
    target: Role,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      name: { type: 'varchar' }
    },
    relations: {
      users: {
        target: 'User',
        type: 'many-to-many',
        inverseSide: 'roles'
      }
    }
  })

  const conn = await createConnection({
    type: 'sqlite',
    database: ':memory:',
    entities: [UserSchema, ProfileSchema, ProjectSchema, DeadlineSchema, RoleSchema]
  })

  return { User, Project, conn }
}

async function seedTypeOrm(conn: OrmContext['conn']) {
  await conn.synchronize(true)
  await conn.createQueryBuilder().insert().into('user').values(relationSeeds.users).execute()
  for (const profile of relationSeeds.profiles) {
    await conn.query(
      'INSERT INTO "profile" ("id", "userId", "display_name") VALUES (?, ?, ?)',
      [profile.id, profile.userId, profile.displayName]
    )
  }
  for (const project of relationSeeds.projects) {
    await conn.query(
      'INSERT INTO "project" ("id", "userId", "name", "active") VALUES (?, ?, ?, ?)',
      [project.id, project.userId, project.name, project.active]
    )
  }
  for (const deadline of relationSeeds.deadlines) {
    await conn.query(
      'INSERT INTO "deadline" ("id", "projectId", "date") VALUES (?, ?, ?)',
      [deadline.id, deadline.projectId, deadline.date]
    )
  }
  await conn.createQueryBuilder().insert().into('role').values(relationSeeds.roles).execute()
  await conn.createQueryBuilder().insert().into('user_roles').values(relationSeeds.userRoles).execute()
}
