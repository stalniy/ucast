import { FieldCondition, CompoundCondition } from '@ucast/core'
import { Collection, EntitySchema, MikroORM, QueryBuilder } from '@mikro-orm/sqlite'
import { interpret } from '../src/lib/mikro-orm.ts'
import { expect } from './specHelper.ts'

type Depromisify<T extends Promise<any>> = T extends Promise<infer A> ? A : never
type OrmContext = Depromisify<ReturnType<typeof configureORM>>

describe('Condition interpreter for MikroORM', () => {
  let orm: OrmContext['orm']
  let User: OrmContext['User']

  before(async () => {
    const ctx = await configureORM()
    orm = ctx.orm
    User = ctx.User
  })

  after(async () => {
    await orm.close()
  })

  it('returns a `QueryBuilder<T>`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query).to.be.instanceof(QueryBuilder)
    expect(query.getQuery()).to.equal('select * from `user` as `u0` where (`name` = ?)')
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal('select * from `user` as `u0` where (`age` in(?, ?, ?))')
  })

  it('automatically inner joins relation when condition is set on relation field', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select *',
      'from `user` as `u0`',
      'inner join `project` as `projects` on `u0`.`id` = `projects`.`user_id`',
      'where (`projects`.`name` = ?)'
    ].join(' '))
  })

  it('should join the same relation exactly one time', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select *',
      'from `user` as `u0`',
      'inner join `project` as `projects` on `u0`.`id` = `projects`.`user_id`',
      'where ((`projects`.`name` = ? and `projects`.`active` = ?))'
    ].join(' '))
  })
})

async function configureORM() {
  class User {
    public id: number
    public name: string
    public projects?: Collection<Project>

    constructor(
      id: number,
      name: string,
      projects?: Collection<Project>
    ) {
      this.id = id
      this.name = name
      this.projects = projects || new Collection<Project>(this)
    }
  }

  class Project {
    public id: number
    public name: string
    public user: User
    public active: boolean

    constructor(
      id: number,
      name: string,
      user: User,
      active: boolean
    ) {
      this.id = id
      this.name = name
      this.user = user
      this.active = active
    }
  }

  const UserSchema = new EntitySchema({
    class: User,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      projects: {
        kind: '1:m',
        entity: 'Project',
        ref: true,
        nullable: false,
        mappedBy: 'user'
      }
    }
  })
  const ProjectSchema = new EntitySchema({
    class: Project,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      user: { entity: 'User', kind: 'm:1', ref: true, nullable: false },
      active: { type: 'boolean' }
    }
  })

  const orm = await MikroORM.init({
    entities: [UserSchema, ProjectSchema],
    dbName: ':memory:',
  })

  return { User, Project, orm }
}
