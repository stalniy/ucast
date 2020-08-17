import { FieldCondition } from '@ucast/core'
import { Model, Sequelize, DataTypes } from 'sequelize'
import { interpret } from '../src/lib/sequelize'
import { expect } from './specHelper'

describe('Condition interpreter for Sequelize', () => {
  const { User } = configureORM()

  it('returns an object with `where` and `include` keys', () => {
    const condition = new FieldCondition('eq', 'name', 'test')
    const query = interpret(condition, User)

    expect(query).to.be.an('object')
    expect(query.where.val).to.equal('`name` = \'test\'')
    expect(query.include).to.be.an('array').that.is.empty
  })

  it('properly binds parameters for "IN" operator', () => {
    const condition = new FieldCondition('in', 'age', [1, 2, 3])
    const query = interpret(condition, User)

    expect(query.where.val).to.equal('`age` in(1, 2, 3)')
  })

  it('automatically inner joins relation when condition is set on relation field', () => {
    const condition = new FieldCondition('eq', 'projects.name', 'test')
    const query = interpret(condition, User)

    expect(query.include).to.deep.equal([
      { association: 'projects', required: true }
    ])
    expect(query.where.val).to.equal('`projects`.`name` = \'test\'')
  })
})

function configureORM() {
  const sequelize = new Sequelize('sqlite::memory:')

  class User extends Model {}
  class Project extends Model {}

  User.init({
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
  }, { sequelize, modelName: 'user' })

  Project.init({
    name: { type: DataTypes.STRING },
    active: { type: DataTypes.BOOLEAN }
  }, { sequelize, modelName: 'project' })

  Project.belongsTo(User)
  User.hasMany(Project)

  return { User, Project }
}
