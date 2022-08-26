import { FieldCondition, CompoundCondition } from '@ucast/core'
import { Model, QueryBuilder } from 'objection'
import Knex from 'knex'
import { interpret } from '../src/lib/objection'
import { expect, linearize } from './specHelper'

describe('Condition interpreter for Objection', () => {
  const { User } = configureORM()

  it('returns `QueryBuilder`', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, User.query())

    expect(query).to.be.instanceOf(QueryBuilder)
  })

  it('properly binds parameters', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where "name" = 'test'
    `.trim())
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(`
      select "users".* from "users" where "age" in(1, 2, 3)
    `.trim())
  })

  it('automatically inner joins relation when condition is set on relation field', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(linearize`
      select "users".*
      from "users"
        inner join "projects" on "projects"."user_id" = "users"."id"
      where "projects"."name" = 'test'
    `.trim())
  })

  it('should join the same relation exactly one time', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.name', 'test'),
      new FieldCondition('eq', 'projects.active', true),
    ])

    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(linearize`
      select "users".*
      from "users"
        inner join "projects" on "projects"."user_id" = "users"."id"
      where ("projects"."name" = 'test' and "projects"."active" = true)
    `.trim())
  })

  it('should treat fields with nested relations as simple fields', () => {
    const condition = new CompoundCondition('and', [
      new FieldCondition('eq', 'projects.reviews.rating', 5),
      new FieldCondition('eq', 'projects.active', true),
    ])
    const query = interpret(condition, User.query())

    expect(query.toKnexQuery().toString()).to.equal(linearize`
      select "users".*
      from "users"
        inner join "projects" on "projects"."user_id" = "users"."id"
      where ("projects.reviews.rating" = 5 and "projects"."active" = true)
    `.trim())
  })
})

function configureORM() {
  Model.knex(Knex({ client: 'pg' }))

  class User extends Model {
    static tableName = 'users'

    static get relationMappings() {
      return {
        projects: {
          relation: Model.HasManyRelation,
          modelClass: Project,
          join: { from: 'users.id', to: 'projects.user_id' }
        }
      }
    }
  }

  class Project extends Model {
    static tableName = 'projects'

    static get relationMappings() {
      return {
        user: {
          relation: Model.BelongsToOneRelation,
          modelClass: User,
          join: { from: 'users.id', to: 'projects.user_id' },
          active: Boolean
        },
        projects: {
          relation: Model.HasManyRelation,
          modelClass: Review,
          join: { from: 'projects.id', to: 'review.project_id' }
        }
      }
    }
  }

  class Review extends Model {
    static tableName = 'reviews'

    static get relationMappings() {
      return {
        project: {
          relation: Model.BelongsToOneRelation,
          modelClass: Project,
          join: { from: 'projects.id', to: 'review.project_id' },
          active: Boolean
        }
      }
    }
  }

  return { User, Project, Review }
}
