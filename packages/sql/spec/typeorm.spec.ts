import { FieldCondition, CompoundCondition } from '@ucast/core'
import {
  EntitySchema,
  createConnection,
  SelectQueryBuilder
} from 'typeorm'
import { interpret } from '../src/lib/typeorm'
import { expect } from './specHelper'

type Depromisify<T extends Promise<any>> = T extends Promise<infer A> ? A : never
type OrmContext = Depromisify<ReturnType<typeof configureORM>>

describe('Condition interpreter for TypeORM', () => {
  let conn: OrmContext['conn']
  let User: OrmContext['User']

  before(async () => {
    const ctx = await configureORM()
    conn = ctx.conn
    User = ctx.User
  })

  after(async () => {
    await conn.close()
  })

  it('returns a `SelectQueryBuilder<T>`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query).to.be.instanceof(SelectQueryBuilder)
    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."name" = :0'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test' })
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'WHERE "u"."age" in(:0, :1, :2)'
    ].join(' '))

    expect(query.getParameters()).to.eql({
      0: 1,
      1: 2,
      2: 3
    })
  })

  it('automatically left joins relation when condition is set on relation field', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'LEFT JOIN "project" "projects" ON "projects"."userId"="u"."id"',
      'WHERE "projects"."name" = :0'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test' })
  })

  it("shouldn't join the same relation several times", () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'LEFT JOIN "project" "projects" ON "projects"."userId"="u"."id"',
      'WHERE ("projects"."name" = :0 and "projects"."active" = :1)'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 'test', 1: true })
  })

  it('should use multiple join to handle deep relations', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.reviews.rating', 5),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, conn.createQueryBuilder(User, 'u'))

    expect(query.getQuery()).to.equal([
      'SELECT "u"."id" AS "u_id", "u"."name" AS "u_name"',
      'FROM "user" "u"',
      'LEFT JOIN "project" "projects" ON "projects"."userId"="u"."id"',
      ' LEFT JOIN "review" "projects_reviews" ON "projects_reviews"."projectId"="projects"."id"',
      'WHERE ("projects_reviews"."rating" = :0 and "projects"."active" = :1)'
    ].join(' '))
    expect(query.getParameters()).to.eql({ 0: 5, 1: true })
  })
})

async function configureORM() {
  class User {
    id!: number
    name!: string
    projects!: Project[]
  }

  class Project {
    id!: number
    name!: string
    user!: User
    reviews!: Review[]
    active!: boolean
  }

  class Review {
    id!: number
    rating!: number
    comment!: string
    project!: Project
  }

  const UserSchema = new EntitySchema<User>({
    name: 'User',
    target: User,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      name: { type: 'varchar' },
    },
    relations: {
      projects: {
        target: 'Project',
        type: 'one-to-many',
        inverseSide: 'user'
      },
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
      reviews: {
        target: 'Review',
        type: 'one-to-many',
        inverseSide: 'project'
      },
    }
  })

  const ReviewSchema = new EntitySchema<Review>({
    name: 'Review',
    target: Review,
    columns: {
      id: { primary: true, type: 'int', generated: true },
      comment: { type: 'varchar' },
      rating: { type: 'int' }
    },
    relations: {
      project: { target: 'Project', type: 'many-to-one' }
    }
  })

  const conn = await createConnection({
    type: 'sqlite',
    database: ':memory:',
    entities: [UserSchema, ProjectSchema, ReviewSchema]
  })

  return { User, Project, Review, conn }
}
