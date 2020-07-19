import { Model } from 'objection'
import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import Knex from 'knex'
import { expect } from './specHelper'
import { createObjectionInterpreter, $eq, $ne, $lte, $lt, $gte, $gt, $exists, $in, $nin, $and, $not, $or } from '../src'

const knex = Knex({ client: 'pg' })
Model.knex(knex)

describe('Condition Interpreter', () => {
  class User extends Model {
    static tableName = 'users'

    static get relationMappings() {
      return {
        projects: {
          relation: Model.HasManyRelation,
          modelClass: Project,
          join: {
            from: 'users.id',
            to: 'projects.user_id'
          }
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
          join: {
            from: 'users.id',
            to: 'projects.user_id'
          }
        }
      }
    }
  }
  describe('$eq', () => {
    const interpret = createObjectionInterpreter({ $eq })
    it('generates query with equal condition', () => {
      const condition = new Field('$eq', 'name', 'test')
      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "name" = \'test\''
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$eq', 'projects.name', 'test')
      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" inner join "projects" on "projects"."user_id" = "users"."id" where "projects"."name" = \'test\''
      )
    })
  })

  describe('$ne', () => {
    const interpret = createObjectionInterpreter({ $ne })
    it('generates query with not equal condition', () => {
      const condition = new Field('$ne', 'name', 'test')
      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where not "name" = \'test\''
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$ne', 'projects.name', 'test')
      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" inner join "projects" on "projects"."user_id" = "users"."id" where not "projects"."name" = \'test\''
      )
    })
  })

  describe('$lte', () => {
    const interpret = createObjectionInterpreter({ $lte })
    it('generates query with lte condition', () => {
      const condition = new Field('$lte', 'age', 10)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" <= 10'
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$lte', 'user.age', 10)
      expect(interpret(condition, Project.query()).toKnexQuery().toString()).to.equal(
        'select "projects".* from "projects" inner join "users" as "user" on "user"."id" = "projects"."user_id" where "user"."age" <= 10'
      )
    })
  })

  describe('$lt', () => {
    const interpret = createObjectionInterpreter({ $lt })
    it('generates query with lt condition', () => {
      const condition = new Field('$lt', 'age', 10)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" < 10'
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$lt', 'user.age', 10)
      expect(interpret(condition, Project.query()).toKnexQuery().toString()).to.equal(
        'select "projects".* from "projects" inner join "users" as "user" on "user"."id" = "projects"."user_id" where "user"."age" < 10'
      )
    })
  })

  describe('$gt', () => {
    const interpret = createObjectionInterpreter({ $gt })
    it('generates query with gt condition', () => {
      const condition = new Field('$gt', 'age', 10)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" > 10'
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$gt', 'user.age', 10)
      expect(interpret(condition, Project.query()).toKnexQuery().toString()).to.equal(
        'select "projects".* from "projects" inner join "users" as "user" on "user"."id" = "projects"."user_id" where "user"."age" > 10'
      )
    })
  })

  describe('$gte', () => {
    const interpret = createObjectionInterpreter({ $gte })
    it('generates query with gte condition', () => {
      const condition = new Field('$gte', 'age', 10)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" >= 10'
      )
    })

    it('generates join relation when using dot notation', () => {
      const condition = new Field('$gte', 'user.age', 10)
      expect(interpret(condition, Project.query()).toKnexQuery().toString()).to.equal(
        'select "projects".* from "projects" inner join "users" as "user" on "user"."id" = "projects"."user_id" where "user"."age" >= 10'
      )
    })
  })

  describe('$exists', () => {
    const interpret = createObjectionInterpreter({ $exists })
    it('generates query with not null condition', () => {
      const condition = new Field('$exists', 'address', true)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "address" is not null'
      )
    })

    it('generates query using join when using dot notation', () => {
      const condition = new Field('$exists', 'projects.due_date', true)

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" inner join "projects" on "projects"."user_id" = "users"."id" where "projects"."due_date" is not null'
      )
    })
  })

  describe('$in', () => {
    const interpret = createObjectionInterpreter({ $in })
    it('generates query with IN condition', () => {
      const condition = new Field('$in', 'age', [1, 2])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" in (1, 2)'
      )
    })
  })

  describe('$nin', () => {
    const interpret = createObjectionInterpreter({ $nin })
    it('generates query with NOT IN condition', () => {
      const condition = new Field('$nin', 'age', [1, 2])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" not in (1, 2)'
      )
    })
  })

  describe('$not', () => {
    const interpret = createObjectionInterpreter({ $not, $eq })
    it('generates query with not condition', () => {
      const condition = new CompoundCondition('$not', [new Field('$eq', 'age', 12)])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where not "age" = 12'
      )
    })
  })

  describe('$and', () => {
    const interpret = createObjectionInterpreter({ $and, $eq })
    it('generates query using logical "and"', () => {
      const condition = new CompoundCondition('$and', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" = 1 and "active" = true'
      )
    })

    it('generates query using join when using dot notation', () => {
      const condition = new CompoundCondition('$and', [
        new Field('$eq', 'projects.name', 'test'),
        new Field('$eq', 'projects.active', true)
      ])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" inner join "projects" on "projects"."user_id" = "users"."id" where "projects"."name" = \'test\' and "projects"."active" = true'
      )
    })
  })

  describe('$or', () => {
    const interpret = createObjectionInterpreter({ $or, $eq })
    it('generates query using logical "or"', () => {
      const condition = new CompoundCondition('$or', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" where "age" = 1 or "active" = true'
      )
    })

    it('generates query using join when using dot notation', () => {
      const condition = new CompoundCondition('$or', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'projects.active', true)
      ])

      expect(interpret(condition, User.query()).toKnexQuery().toString()).to.equal(
        'select "users".* from "users" inner join "projects" on "projects"."user_id" = "users"."id" where "age" = 1 or "projects"."active" = true'
      )
    })
  })
})
