import { FieldCondition } from '@ucast/core'
import { QueryBuilder } from '@mikro-orm/knex'
import { MikroORM, Collection, EntitySchema } from '@mikro-orm/sqlite'
import { interpret } from '../src/lib/mikro-orm'
import { expect } from './specHelper'

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
    expect(query.getQuery()).to.equal('select * from `user` as `e0` where (`name` = ?)')
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal('select * from `user` as `e0` where (`age` in(?, ?, ?))')
  })

  it('automatically inner joins relation when condition is set on relation field', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select *',
      'from `user` as `e0`',
      'inner join `project` as `projects` on `e0`.`id` = `projects`.`user_id`',
      'where (`projects`.`name` = ?)'
    ].join(' '))
  })
})

async function configureORM() {
  class User {
    constructor(
      public id: number,
      public name: string,
      public projects?: Collection<Project>
    ) {
      this.projects = projects || new Collection<Project>(this)
    }
  }

  class Project {
    constructor(
      public id: number,
      public name: string,
      public user: User
    ) {}
  }

  const UserSchema = new EntitySchema({
    class: User,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      projects: {
        type: 'Project',
        reference: '1:m',
        inversedBy: 'user'
      }
    }
  })
  const ProjectSchema = new EntitySchema({
    class: Project,
    properties: {
      id: { type: 'number', primary: true },
      name: { type: 'string' },
      user: { type: 'User', reference: 'm:1' },
    }
  })

  const orm = await MikroORM.init({
    entities: [UserSchema, ProjectSchema],
    dbName: ':memory:',
  })

  return { User, Project, orm }
}
