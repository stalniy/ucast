import { FieldCondition, CompoundCondition } from '@ucast/core'
import { Collection, EntitySchema, MikroORM, QueryBuilder } from '@mikro-orm/sqlite'
import { createInterpreter, getRelationMetadata, interpret } from '../src/lib/mikro-orm.ts'
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

describe('Condition interpreter for MikroORM', () => {
  let ctx: OrmContext
  let orm: OrmContext['orm']
  let User: OrmContext['User']
  let Project: OrmContext['Project']

  before(async () => {
    ctx = await configureORM()
    orm = ctx.orm
    User = ctx.User
    Project = ctx.Project
  })

  after(async () => {
    await orm.close()
  })

  it('returns a `QueryBuilder<T>`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query).to.be.instanceof(QueryBuilder)
    expect(query.getQuery()).to.equal('select * from `user` as `u0` where (`u0`.`name` = ?)')
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal('select * from `user` as `u0` where (`u0`.`age` in(?, ?, ?))')
  })

  it('treats dotted field names as literal fields', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal('select * from `user` as `u0` where (`u0`.`projects.name` = ?)')
  })

  it("doesn't auto join dotted fields in compound conditions", () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal('select * from `user` as `u0` where ((`u0`.`projects.name` = ? and `u0`.`projects.active` = ?))')
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
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select * from `user` as `u0`',
      'where (EXISTS (SELECT 1 FROM `project` as `projects_0`',
      'WHERE `u0`.`id` = `projects_0`.`user_id`',
      'AND (EXISTS (SELECT 1 FROM `deadline` as `deadlines_1`',
      'WHERE `projects_0`.`id` = `deadlines_1`.`project_id`',
      'AND (`deadlines_1`.`date` = ?)))))'
    ].join(' '))
  })

  it('uses the pivot table for many-to-many relations', () => {
    const condition = new FieldCondition(
      'some',
      'roles',
      new FieldCondition('eq', 'name', 'admin')
    )
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))
    const sql = query.getQuery()

    expect(sql).to.contain('SELECT 1 FROM `user_roles` as `roles_')
    expect(sql).to.contain('_through` INNER JOIN `role` as `roles_')
    expect(sql).to.contain('`.`id` = `roles_')
    expect(sql).to.contain('_through`.`role_id`')
    expect(sql).to.contain('`u0`.`id` = `roles_')
    expect(sql).to.contain('_through`.`user_id`')
    expect(sql).to.contain('`.`name` = ?')
  })

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = createInterpreter({ eq, some: someRelation }, {
      getRelationMetadata(relationName, ctx) {
        if (relationName !== 'projects') {
          return getRelationMetadata(relationName, ctx)
        }

        return {
          relationContext: orm.getMetadata().get(Project.name),
          buildRelationQuery(relation) {
            const tenantProjectAlias = 'tenant_projects'
            const tenantProjectField = (field: string) => {
              return `${relation.escapeField(tenantProjectAlias)}.${relation.escapeField(field)}`
            }

            return `SELECT 1 FROM ${relation.escapeField('tenant_projects')} as ${relation.escapeField(tenantProjectAlias)}` +
            ` INNER JOIN ${relation.escapeField('project')} as ${relation.escapeField(relation.relationAlias)}` +
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
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.contain('`tenant_projects`.`kind` = ? AND (')
    expect(query.getQuery()).to.contain('`.`active` = ?')
  })

  describe('SQLite relation e2e', () => {
    before(async () => {
      await seedMikroOrm(ctx)
    })

    it('filters 1:m relations', async () => {
      const users = await interpret(
        relationConditions.hasMany,
        orm.em.fork().createQueryBuilder(User).select([])
      ).orderBy({ name: 'ASC' }).getResultList()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasMany)
    })

    it('filters m:1 relations', async () => {
      const projects = await interpret(
        relationConditions.belongsTo,
        orm.em.fork().createQueryBuilder(Project).select([])
      ).orderBy({ name: 'ASC' }).getResultList()

      expect(namesOf(projects)).to.deep.equal(expectedRelationNames.belongsTo)
    })

    it('filters 1:1 relations', async () => {
      const users = await interpret(
        relationConditions.hasOne,
        orm.em.fork().createQueryBuilder(User).select([])
      ).orderBy({ name: 'ASC' }).getResultList()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasOne)
    })

    it('filters m:n relations', async () => {
      const users = await interpret(
        relationConditions.manyToMany,
        orm.em.fork().createQueryBuilder(User).select([])
      ).orderBy({ name: 'ASC' }).getResultList()

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.manyToMany)
    })
  })
})

async function configureORM() {
  class User {
    public id: number
    public tenantId: string
    public name: string
    public profile?: Profile
    public projects?: Collection<Project>
    public roles?: Collection<Role>

    constructor(
      id: number,
      tenantId: string,
      name: string,
      projects?: Collection<Project>,
      roles?: Collection<Role>
    ) {
      this.id = id
      this.tenantId = tenantId
      this.name = name
      this.projects = projects || new Collection<Project>(this)
      this.roles = roles || new Collection<Role>(this)
    }
  }

  class Profile {
    public id: number
    public displayName: string
    public user: User

    constructor(
      id: number,
      displayName: string,
      user: User
    ) {
      this.id = id
      this.displayName = displayName
      this.user = user
    }
  }

  class Project {
    public id: number
    public name: string
    public user: User
    public active: boolean
    public deadlines?: Collection<Deadline>

    constructor(
      id: number,
      name: string,
      user: User,
      active: boolean,
      deadlines?: Collection<Deadline>
    ) {
      this.id = id
      this.name = name
      this.user = user
      this.active = active
      this.deadlines = deadlines || new Collection<Deadline>(this)
    }
  }

  class Deadline {
    public id: number
    public date: string
    public project: Project

    constructor(
      id: number,
      date: string,
      project: Project
    ) {
      this.id = id
      this.date = date
      this.project = project
    }
  }

  class Role {
    public id: number
    public name: string
    public users?: Collection<User>

    constructor(
      id: number,
      name: string,
      users?: Collection<User>
    ) {
      this.id = id
      this.name = name
      this.users = users || new Collection<User>(this)
    }
  }

  const UserSchema = new EntitySchema({
    class: User,
    properties: {
      id: { type: 'number', primary: true },
      tenantId: { type: 'string' },
      name: { type: 'string' },
      profile: {
        kind: '1:1',
        entity: 'Profile',
        ref: true,
        nullable: true,
        mappedBy: 'user'
      },
      projects: {
        kind: '1:m',
        entity: 'Project',
        ref: true,
        nullable: false,
        mappedBy: 'user'
      },
      roles: {
        kind: 'm:n',
        entity: 'Role',
        owner: true,
        inversedBy: 'users',
        pivotTable: 'user_roles'
      }
    }
  })
  const ProfileSchema = new EntitySchema({
    class: Profile,
    properties: {
      id: { type: 'number', primary: true },
      displayName: { type: 'string', fieldName: 'display_name' },
      user: {
        entity: 'User',
        kind: '1:1',
        owner: true,
        ref: true,
        nullable: false
      }
    }
  })
  const ProjectSchema = new EntitySchema({
    class: Project,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      user: { entity: 'User', kind: 'm:1', ref: true, nullable: false },
      active: { type: 'boolean' },
      deadlines: {
        kind: '1:m',
        entity: 'Deadline',
        ref: true,
        nullable: false,
        mappedBy: 'project'
      }
    }
  })
  const DeadlineSchema = new EntitySchema({
    class: Deadline,
    properties: {
      id: { type: 'number', primary: true },
      date: { type: 'string' },
      project: { entity: 'Project', kind: 'm:1', ref: true, nullable: false }
    }
  })
  const RoleSchema = new EntitySchema({
    class: Role,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      users: {
        kind: 'm:n',
        entity: 'User',
        mappedBy: 'roles'
      }
    }
  })

  const orm = await MikroORM.init({
    entities: [UserSchema, ProfileSchema, ProjectSchema, DeadlineSchema, RoleSchema],
    dbName: ':memory:',
  })

  return { Deadline, Profile, Project, Role, User, orm }
}

async function seedMikroOrm({
  Deadline,
  Profile,
  Project,
  Role,
  User,
  orm
}: OrmContext) {
  await orm.schema.createSchema()
  const em = orm.em.fork()

  const users = new Map(relationSeeds.users.map(user => [
    user.id,
    new User(user.id, user.tenantId, user.name),
  ]))
  const roles = new Map(relationSeeds.roles.map(role => [
    role.id,
    new Role(role.id, role.name),
  ]))
  const projects = relationSeeds.projects.map(project => new Project(
    project.id,
    project.name,
    users.get(project.userId)!,
    project.active
  ))
  const deadlines = relationSeeds.deadlines.map(deadline => new Deadline(
    deadline.id,
    deadline.date,
    projects.find(project => project.id === deadline.projectId)!
  ))
  const profiles = relationSeeds.profiles.map(profile => {
    const user = users.get(profile.userId)!
    const entity = new Profile(profile.id, profile.displayName, user)

    user.profile = entity
    return entity
  })

  relationSeeds.userRoles.forEach(({ userId, roleId }) => {
    users.get(userId)!.roles!.add(roles.get(roleId)!)
  })

  em.persist([
    ...users.values(),
    ...roles.values(),
    ...profiles,
    ...projects,
    ...deadlines,
  ])
  await em.flush()
  em.clear()
}
