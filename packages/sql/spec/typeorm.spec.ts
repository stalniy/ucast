import { FieldCondition, buildAnd } from '@ucast/core'
import {
  DataSource,
  type EntityMetadata,
  EntitySchema,
  SelectQueryBuilder
} from 'typeorm'
import { createTypeOrmInterpreter, typeormToSqlMetadata, interpret } from '../src/lib/typeorm.ts'
import { expect, linearize } from './specHelper.ts'
import { eq, someRelation } from '../src/interpreters.ts'
import { createDefaultSqlComposer } from '../src/interpreter.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

type OrmContext = Awaited<ReturnType<typeof configureORM>>

describe(createTypeOrmInterpreter.name, () => {
  it('maps property paths and keeps unknown database identifiers', () => {
    const metadata = typeormToSqlMetadata({
      columns: [{ propertyPath: 'displayName', databaseName: 'display_name' }],
      findRelationWithPropertyPath: () => undefined,
    } as unknown as EntityMetadata)

    expect(metadata.toColumnName!('displayName')).to.equal('display_name')
    expect(metadata.toColumnName!('legacy_column')).to.equal('legacy_column')
    expect(metadata.resolveRelation!('missing')).to.equal(undefined)
  })

  it('does not collapse composite foreign keys into a scalar field', () => {
    const metadata = typeormToSqlMetadata({
      findColumnsWithPropertyPath: () => [
        { databaseName: 'owner_tenant_id' },
        { databaseName: 'owner_id' },
      ],
      findRelationWithPropertyPath: () => undefined,
    } as unknown as EntityMetadata)

    expect(() => metadata.toColumnName!('owner')).to.throw('maps to multiple database columns')
  })
})

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
        new FieldCondition('some', 'user', new FieldCondition('eq', 'tenantId', 1))
      ]),
      conn.createQueryBuilder(Profile, 'p').select('p.*'),
    )

    expect(query.getQuery()).to.equal(linearize`
      SELECT p.* FROM "profile" "p"
      WHERE ("p"."display_name" = :0 and EXISTS (
        SELECT 1
        FROM "user" as "user_ucast0"
        WHERE "p"."userId" = "user_ucast0"."id" AND "user_ucast0"."tenant_id" = :1
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
    )).to.throw('Relation metadata for "u.missingRelation" not found')
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
    const metadata = typeormToSqlMetadata(conn.createQueryBuilder(User, 'u')).resolveRelation!('projects')

    expect(metadata).to.include({ relatedTable: 'project' })
    expect(metadata).to.have.property('ownField').that.deep.equals(['id'])
    expect(metadata).to.have.property('relatedField').that.deep.equals(['userId'])
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
    const run = createTypeOrmInterpreter({ eq, some: someRelation }, {
      createSqlComposer: options => createDefaultSqlComposer({
        ...options,
        metadata: {
          resolveRelation: () => ({
            ownField: 'id',
            relatedField: 'parent_id',
            relatedTable: 'external_records',
            metadata: {},
          }),
        },
      }),
    })
    const query = run(
      new FieldCondition('some', 'external', new FieldCondition('eq', 'legacy_column', 'Ada')),
      conn.createQueryBuilder(User, 'u'),
    )

    expect(query.getQuery()).to.contain('"external_ucast0"."legacy_column" = :0')
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
      'WHERE EXISTS (SELECT 1 FROM "composite_owner" as "owner_ucast0" ' +
      'WHERE "i"."owner_tenant_id" = "owner_ucast0"."tenant_id" ' +
      'AND "i"."owner_id" = "owner_ucast0"."id" AND "owner_ucast0"."display_name" = :0)',
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
        'SELECT 1 FROM "project" as "projects_ucast0"',
        'WHERE "u"."id" = "projects_ucast0"."userId"',
        'AND EXISTS (' +
          'SELECT 1 FROM "deadline" as "deadlines_ucast1"',
          'WHERE "projects_ucast0"."id" = "deadlines_ucast1"."projectId"',
          'AND "deadlines_ucast1"."date" = :0' +
        ')' +
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

    expect(sql).to.contain('SELECT 1 FROM "role" as "roles_ucast0"')
    expect(sql).to.contain('INNER JOIN "user_roles" as "roles_ucast0_through"')
    expect(sql).to.contain('"roles_ucast0"."id" = "roles_ucast0_through"."roleId"')
    expect(sql).to.contain('"u"."id" = "roles_ucast0_through"."userId"')
    expect(sql).to.contain('"roles_ucast0"."name" = :0')
    expect(query.getParameters()).to.eql({ 0: 'admin' })
  })

  function interpretDomainProjects() {
    return createTypeOrmInterpreter({ eq, some: someRelation }, {
      createSqlComposer(options) {
        const composer = createDefaultSqlComposer(options)
        return {
          ...composer,
          relation(name) {
            if (name !== 'projects') return composer.relation(name)
            const alias = 'domain_projects'
            const child = createDefaultSqlComposer({
              ...options,
              alias,
              metadata: typeormToSqlMetadata(conn.getMetadata(Project)),
            }, composer)
            const identifier = options.escapeIdentifier
            const tenantProjectField = (field: string) =>
              `${identifier('tenant_projects')}.${identifier(field)}`

            return {
              composer: child,
              subquery(predicate) {
                return `SELECT 1 FROM ${identifier('tenant_projects')} as ${identifier('tenant_projects')}` +
                  ` INNER JOIN ${identifier('project')} as ${identifier(alias)}` +
                  ` ON ${child.field('id')} = ${tenantProjectField('projectId')}` +
                  ` WHERE ${composer.field('tenantId')} = ${tenantProjectField('tenantId')}` +
                  ` AND (${predicate})` +
                  ` AND ${tenantProjectField('kind')} = ${composer.param('owned')}`
              },
            }
          },
        }
      },
    })
  }

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = interpretDomainProjects()
    const condition = new FieldCondition(
      'some',
      'projects',
      new FieldCondition('eq', 'active', true)
    )
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.contain('"tenant_projects"."kind" = :1')
    expect(query.getQuery()).to.contain('"domain_projects"."active" = :0')
    expect(query.getParameters()).to.eql({ 0: true, 1: 'owned' })
  })

  describe('SQLite relation e2e', () => {
    before(async () => {
      await seedTypeOrm(conn)
    })

    it('executes custom domain joins with their own bound values', async () => {
      await conn.query('CREATE TABLE "tenant_projects" ("tenantId" TEXT, "projectId" INTEGER, "kind" TEXT)')
      await conn.query('INSERT INTO "tenant_projects" ("tenantId", "projectId", "kind") VALUES (?, ?, ?), (?, ?, ?)',
        ['tenant-a', 1, 'owned', 'tenant-b', 4, 'owned'])
      const users = await interpretDomainProjects()(
        new FieldCondition('some', 'projects', new FieldCondition('eq', 'active', true)),
        conn.createQueryBuilder(User, 'u'),
      ).getMany()

      expect(namesOf(users)).to.deep.equal(['Alice', 'Bob'])
    })

    it('executes mapped scalar predicates and membership parameters', async () => {
      const profiles = await interpret(
        buildAnd([
          new FieldCondition('eq', 'displayName', 'Alice Profile'),
          new FieldCondition('in', 'id', [1, 2]),
        ]),
        conn.createQueryBuilder(Profile, 'p'),
      ).getMany()

      expect(profiles.map(profile => profile.displayName)).to.deep.equal(['Alice Profile'])
    })

    it('executes nested relation predicates', async () => {
      const users = await interpret(
        new FieldCondition('some', 'projects',
          new FieldCondition('some', 'deadlines', new FieldCondition('eq', 'date', '2026-06-28'))),
        conn.createQueryBuilder(User, 'u'),
      ).getMany()

      expect(namesOf(users)).to.deep.equal(['Alice'])
    })

    it('executes none and every predicates with shared parameter binding', async () => {
      const none = await interpret(
        new FieldCondition('none', 'projects', new FieldCondition('eq', 'active', true)),
        conn.createQueryBuilder(User, 'u'),
      ).getMany()
      const every = await interpret(
        new FieldCondition('every', 'projects', new FieldCondition('eq', 'active', true)),
        conn.createQueryBuilder(User, 'u'),
      ).getMany()

      expect(namesOf(none)).to.deep.equal(['Carol'])
      expect(namesOf(every)).to.deep.equal(['Bob'])
    })

    it('matches every composite foreign-key column', async () => {
      await conn.query('INSERT INTO "composite_owner" ("tenant_id", "id", "display_name") VALUES (?, ?, ?), (?, ?, ?)',
        ['tenant-a', 1, 'Ada', 'tenant-b', 1, 'Grace'])
      await conn.query('INSERT INTO "composite_item" ("id", "owner_tenant_id", "owner_id") VALUES (?, ?, ?), (?, ?, ?)',
        [1, 'tenant-a', 1, 2, 'tenant-b', 1])
      const items = await interpret(
        new FieldCondition('some', 'owner', new FieldCondition('eq', 'displayName', 'Ada')),
        conn.createQueryBuilder(CompositeItem, 'i'),
      ).getMany()

      expect(items.map(item => item.id)).to.deep.equal([1])
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
