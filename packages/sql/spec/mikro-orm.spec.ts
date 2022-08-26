import { FieldCondition, CompoundCondition } from '@ucast/core'
import { MikroORM, Collection, EntitySchema, QueryBuilder } from 'mikro-orm'
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

  it('should join the same relation exactly one time', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select *',
      'from `user` as `e0`',
      'inner join `project` as `projects` on `e0`.`id` = `projects`.`user_id`',
      'where ((`projects`.`name` = ? and `projects`.`active` = ?))'
    ].join(' '))
  })

  it('should treat fields with nested relations as simple fields', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.reviews.rating', 5),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, orm.em.createQueryBuilder(User).select([]))

    expect(query.getQuery()).to.equal([
      'select *',
      'from `user` as `e0`',
      'inner join `project` as `projects` on `e0`.`id` = `projects`.`user_id`',
      'where ((`projects.reviews.rating` = ? and `projects`.`active` = ?))'
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
      public user: User,
      public reviews: Collection<Review>,
      public active: boolean
    ) {}
  }

  class Review {
    constructor(
      public id: number,
      public rating: number,
      public comment: string,
      public project: Project
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
      reviews: { type: 'Review', reference: '1:m', inversedBy: 'project' },
      active: { type: 'boolean' }
    }
  })
  const ReviewSchema = new EntitySchema({
    class: Review,
    properties: {
      id: { type: 'number', primary: true },
      rating: { type: 'number' },
      project: { type: 'Project', reference: 'm:1' },
      comment: { type: 'string' }
    }
  })

  const orm = await MikroORM.init({
    entities: [UserSchema, ProjectSchema, ReviewSchema],
    dbName: ':memory:',
    type: 'sqlite',
  })

  return { User, Project, orm }
}
