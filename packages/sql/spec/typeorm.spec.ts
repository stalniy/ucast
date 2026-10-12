import { FieldCondition, buildAnd } from '@ucast/core'
import {
  DataSource,
  EntitySchema,
  SelectQueryBuilder
} from 'typeorm'
import { createInterpreter, getRelationMetadata, interpret } from '../src/lib/typeorm.ts'
import { pg } from '../src/dialects.ts'
import { expect, linearize } from './specHelper.ts'
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
  let Profile: OrmContext['Profile']
  let CompositeItem: OrmContext['CompositeItem']
  let Role: OrmContext['Role']

  before(async () => {
    const ctx = await configureORM()
    conn = ctx.conn
    User = ctx.User
    Project = ctx.Project
    Profile = ctx.Profile
    CompositeItem = ctx.CompositeItem
    Role = ctx.Role
  })

  after(async () => {
    await conn?.destroy()
  })

  it('returns a `SelectQueryBuilder<T>`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query).to.be.instanceof(SelectQueryBuilder)
    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenant_id" AS "u_tenant_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."name" = :0'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test' })
  })

  it('maps a model property to its configured database column', () => {
    const query = interpret(
      new FieldCondition('eq', 'displayName', 'Ada'),
      conn.createQueryBuilder(Profile, 'p'),
    )
    expect(query.getQuery()).to.contain('WHERE "p"."display_name" = :0')
    expect(query.getParameters()).to.eql({ 0: 'Ada' })
  })

  it('maps a model property to its configured database column for related models', () => {
    const query = interpret(
      buildAnd([
        new FieldCondition('eq', 'displayName', 'Alice Profile'),
        new FieldCondition('is', 'user', new FieldCondition('eq', 'tenantId', 1))
      ]),
      conn.createQueryBuilder(Profile, 'p').select('p.*'),
    )

    expect(query.getQuery()).to.equal(linearize`
      SELECT p.* FROM "profile" "p"
      WHERE ("p"."display_name" = :0 and EXISTS (
        SELECT 1
        FROM "user" as "user_0"
        WHERE "p"."userId" = "user_0"."id" AND ("user_0"."tenant_id" = :1)
      ))
    `)
    expect(query.getParameters()).to.eql({ 0: 'Alice Profile', 1: 1 })
  })

  it('maps an owning relation property to its single foreign-key column', () => {
    const query = interpret(
      new FieldCondition('eq', 'user', 1),
      conn.createQueryBuilder(Profile, 'p'),
    )
    expect(query.getQuery()).to.contain('WHERE "p"."userId" = :0')
  })

  it('reports unknown relations before producing SQL', () => {
    expect(() => interpret(
      new FieldCondition('some', 'missingRelation', new FieldCondition('eq', 'name', 'Ada')),
      conn.createQueryBuilder(User, 'u'),
    )).to.throw('Relation metadata for "missingRelation" not found')
  })

  it('rejects unsupported database dialects', () => {
    const query = conn.createQueryBuilder(User, 'u')
    const options = conn.options as { type: string }
    const originalType = options.type

    try {
      options.type = 'mongodb'
      expect(() => interpret(new FieldCondition('eq', 'name', 'Ada'), query))
        .to.throw('Unsupported database dialect: mongodb')
    } finally {
      options.type = originalType
    }
  })

  it('accepts a query builder as the relation metadata context', () => {
    const metadata = getRelationMetadata('projects', {
      escape: pg.escapeField,
      relationContext: conn.createQueryBuilder(User, 'u'),
    })

    expect(metadata).to.include({
      parentField: 'id',
      relationField: 'userId',
      relationTable: 'project',
      relationContext: conn.getMetadata(Project),
    })
  })

  it('supports query builders exposing connection instead of dataSource', () => {
    const query = conn.createQueryBuilder(Profile, 'p')
    const legacyQuery: typeof query = Object.create(query)
    Object.defineProperty(legacyQuery, 'dataSource', { value: undefined })
    Object.defineProperty(legacyQuery, 'connection', { value: conn })
    legacyQuery.where = query.where.bind(query)

    const result = interpret(new FieldCondition('eq', 'displayName', 'Ada'), legacyQuery)

    expect(result).to.equal(query)
    expect(result.getQuery()).to.contain('WHERE "p"."display_name" = :0')
    expect(result.getParameters()).to.eql({ 0: 'Ada' })
  })

  it('keeps literal fields in custom relations without entity metadata', () => {
    const run = createInterpreter({ eq, some: someRelation }, {
      getRelationMetadata: () => ({
        parentField: 'id',
        relationField: 'parent_id',
        relationTable: 'external_records',
        relationContext: { expressionMap: {} },
      }),
    })
    const query = run(
      new FieldCondition('some', 'external', new FieldCondition('eq', 'legacy_column', 'Ada')),
      conn.createQueryBuilder(User, 'u'),
    )

    expect(query.getQuery()).to.contain('"external_0"."legacy_column" = :0')
    expect(query.getParameters()).to.eql({ 0: 'Ada' })
  })

  describe('metadata without the column lookup method', () => {
    beforeEach(() => {
      [Profile, CompositeItem].forEach(Entity => {
        Object.defineProperty(conn.getMetadata(Entity), 'findColumnsWithPropertyPath', {
          value: undefined,
          configurable: true,
        })
      })
    })

    afterEach(() => {
      [Profile, CompositeItem].forEach(Entity => {
        Reflect.deleteProperty(conn.getMetadata(Entity), 'findColumnsWithPropertyPath')
      })
    })

    it('maps scalar property paths through column metadata', () => {
      const query = interpret(
        new FieldCondition('eq', 'displayName', 'Ada'),
        conn.createQueryBuilder(Profile, 'p'),
      )

      expect(query.getQuery()).to.contain('WHERE "p"."display_name" = :0')
      expect(query.getParameters()).to.eql({ 0: 'Ada' })
    })

    it('maps owning relation properties through join metadata', () => {
      const query = interpret(
        new FieldCondition('eq', 'user', 1),
        conn.createQueryBuilder(Profile, 'p'),
      )

      expect(query.getQuery()).to.contain('WHERE "p"."userId" = :0')
      expect(query.getParameters()).to.eql({ 0: 1 })
    })

    it('keeps unresolved properties as literal identifiers', () => {
      const query = interpret(
        new FieldCondition('eq', 'legacy_column', 'Ada'),
        conn.createQueryBuilder(Profile, 'p'),
      )

      expect(query.getQuery()).to.contain('WHERE "p"."legacy_column" = :0')
      expect(query.getParameters()).to.eql({ 0: 'Ada' })
    })

    it('still rejects scalar conditions on composite relations', () => {
      expect(() => interpret(
        new FieldCondition('eq', 'owner', 1),
        conn.createQueryBuilder(CompositeItem, 'i'),
      )).to.throw('maps to multiple database columns')
    })
  })

  it('rejects scalar conditions on relations with composite foreign keys', () => {
    expect(() => interpret(
      new FieldCondition('eq', 'owner', 1),
      conn.createQueryBuilder(CompositeItem, 'i'),
    ))
      .to.throw('maps to multiple database columns')
  })

  it('keeps composite relation join columns physical', () => {
    const query = interpret(
      new FieldCondition(
        'some',
        'owner',
        new FieldCondition('eq', 'displayName', 'Ada'),
      ),
      conn.createQueryBuilder(CompositeItem, 'i'),
    )

    expect(query.getQuery()).to.contain(
      'WHERE EXISTS (SELECT 1 FROM "composite_owner" as "owner_0" ' +
      'WHERE "i"."owner_tenant_id" = "owner_0"."tenant_id" ' +
      'AND "i"."owner_id" = "owner_0"."id" AND ("owner_0"."display_name" = :0))',
    )
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenant_id" AS "u_tenant_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."age" in(:0, :1, :2)'
    ].join(' '))

    expect(query.getParameters()).to.eql({
      0: 1,
      1: 2,
      2: 3
    })
  })

  it('supports TypeORM better-sqlite3 dialect name', () => {
    const options = conn.options as { type: string }
    const originalType = options.type
    const condition = new FieldCondition('eq', 'name', 'test')

    try {
      options.type = 'better-sqlite3'
      const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

      expect(query.getQuery()).to.equal([
        'SELECT "u"."id" AS "u_id", "u"."tenant_id" AS "u_tenant_id", "u"."name" AS "u_name"',
        'FROM "user" "u"',
        'WHERE "u"."name" = :0'
      ].join(' '))
      expect(query.getParameters()).to.eql({ 0: 'test' })
    } finally {
      options.type = originalType
    }
  })

  it('treats dotted field names as literal fields', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."tenant_id" AS "u_tenant_id", "u"."name" AS "u_name"',
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
      'SELECT "u"."id" AS "u_id", "u"."tenant_id" AS "u_tenant_id", "u"."name" AS "u_name"',
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

    it('filters inverse many-to-many relations through the owner junction metadata', async () => {
      const roles = await interpret(
        new FieldCondition('some', 'users', new FieldCondition('eq', 'name', 'Bob')),
        conn.createQueryBuilder(Role, 'r'),
      ).getMany()

      expect(namesOf(roles)).to.deep.equal(['editor'])
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
    displayName!: string
    users!: User[]
  }

  class CompositeOwner {
    tenantId!: string
    id!: number
    displayName!: string
  }

  class CompositeItem {
    id!: number
    owner!: CompositeOwner
  }

  const UserSchema = new EntitySchema<User>({
    name: 'User',
    target: User,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      tenantId: { type: 'varchar', name: 'tenant_id' },
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
      name: { type: 'varchar' },
      displayName: { type: 'varchar', name: 'display_name' },
    },
    relations: {
      users: {
        target: 'User',
        type: 'many-to-many',
        inverseSide: 'roles'
      }
    }
  })

  const CompositeOwnerSchema = new EntitySchema<CompositeOwner>({
    name: 'CompositeOwner',
    target: CompositeOwner,
    columns: {
      tenantId: { primary: true, type: 'varchar', name: 'tenant_id' },
      id: { primary: true, type: 'int' },
      displayName: { type: 'varchar', name: 'display_name' },
    },
  })

  const CompositeItemSchema = new EntitySchema<CompositeItem>({
    name: 'CompositeItem',
    target: CompositeItem,
    columns: {
      id: { primary: true, type: 'int', generated: true },
    },
    relations: {
      owner: {
        target: 'CompositeOwner',
        type: 'many-to-one',
        joinColumn: [
          { name: 'owner_tenant_id', referencedColumnName: 'tenantId' },
          { name: 'owner_id', referencedColumnName: 'id' },
        ],
      },
    },
  })

  const conn = await new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: [
      UserSchema,
      ProfileSchema,
      ProjectSchema,
      DeadlineSchema,
      RoleSchema,
      CompositeOwnerSchema,
      CompositeItemSchema,
    ]
  }).initialize()

  return { User, Project, Profile, CompositeItem, Role, conn }
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
