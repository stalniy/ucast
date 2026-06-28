import { FieldCondition } from '@ucast/core'
import { Model, Sequelize, DataTypes } from 'sequelize'
import { createInterpreter, getRelationMetadata, interpret } from '../src/lib/sequelize.ts'
import { expect } from './specHelper.ts'
import { eq, someRelation } from '../src/interpreters.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

describe('Condition interpreter for Sequelize', () => {
  const orm = configureORM()
  const { Project, User, sequelize } = orm

  after(async () => {
    await sequelize.close()
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

    const query = interpret(condition, User)

    expect(query.where.val).to.equal(
      "EXISTS (SELECT 1 FROM `projects` as `projects_0` WHERE `users`.`id` = `projects_0`.`userId` " +
      "AND (EXISTS (SELECT 1 FROM `deadlines` as `deadlines_1` WHERE `projects_0`.`id` = `deadlines_1`.`projectId` " +
      "AND (`deadlines_1`.`date` = '2026-06-28'))))"
    )
  })

  it('uses the through table for BelongsToMany relations', () => {
    const condition = new FieldCondition(
      'some',
      'roles',
      new FieldCondition('eq', 'name', 'admin')
    )

    const query = interpret(condition, User)
    const sql = query.where.val

    expect(sql).to.contain('SELECT 1 FROM `user_roles` as `roles_')
    expect(sql).to.contain('_through` INNER JOIN `roles` as `roles_')
    expect(sql).to.contain('`.`id` = `roles_')
    expect(sql).to.contain('_through`.`roleId`')
    expect(sql).to.contain('`users`.`id` = `roles_')
    expect(sql).to.contain('_through`.`userId`')
    expect(sql).to.contain("`.`name` = 'admin'")
  })

  it('allows custom relation SQL to add domain joins and parameters', () => {
    const interpret = createInterpreter({ eq, some: someRelation }, {
      getRelationMetadata(relationName, ctx) {
        if (relationName !== 'projects') {
          return getRelationMetadata(relationName, ctx)
        }

        return {
          relationContext: Project,
          buildRelationQuery(relation) {
            const tenantProjectAlias = 'tenant_projects'
            const tenantProjectField = (field: string) => {
              return `${relation.escapeField(tenantProjectAlias)}.${relation.escapeField(field)}`
            }

            return `SELECT 1 FROM ${relation.escapeField('tenant_projects')} as ${relation.escapeField(tenantProjectAlias)}` +
            ` INNER JOIN ${relation.escapeField('projects')} as ${relation.escapeField(relation.relationAlias)}` +
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
    const query = interpret(condition, User)

    expect(query.where.val).to.contain("`tenant_projects`.`kind` = 'owned' AND (")
    expect(query.where.val).to.contain('`.`active` = 1')
  })

  describe('SQLite relation e2e', () => {
    before(async () => {
      await seedSequelize(orm)
    })

    it('filters HasMany relations', async () => {
      const users = await User.findAll({
        ...interpret(relationConditions.hasMany, User, { rootAlias: 'user' }),
        order: [['name', 'ASC']],
        raw: true,
      })

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasMany)
    })

    it('filters BelongsTo relations', async () => {
      const projects = await Project.findAll({
        ...interpret(relationConditions.belongsTo, Project, { rootAlias: 'project' }),
        order: [['name', 'ASC']],
        raw: true,
      })

      expect(namesOf(projects)).to.deep.equal(expectedRelationNames.belongsTo)
    })

    it('filters HasOne relations', async () => {
      const users = await User.findAll({
        ...interpret(relationConditions.hasOne, User, { rootAlias: 'user' }),
        order: [['name', 'ASC']],
        raw: true,
      })

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.hasOne)
    })

    it('filters BelongsToMany relations', async () => {
      const users = await User.findAll({
        ...interpret(relationConditions.manyToMany, User, { rootAlias: 'user' }),
        order: [['name', 'ASC']],
        raw: true,
      })

      expect(namesOf(users)).to.deep.equal(expectedRelationNames.manyToMany)
    })
  })
})

function configureORM() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  })

  class User extends Model {
    name!: string
  }
  class Profile extends Model {}
  class Project extends Model {
    name!: string
  }
  class Deadline extends Model {}
  class Role extends Model {}
  class UserRole extends Model {}

  User.init({
    tenantId: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
  }, { sequelize, modelName: 'user' })

  Profile.init({
    displayName: { type: DataTypes.STRING, field: 'display_name' },
  }, { sequelize, modelName: 'profile' })

  Project.init({
    name: { type: DataTypes.STRING },
    active: { type: DataTypes.BOOLEAN }
  }, { sequelize, modelName: 'project' })

  Deadline.init({
    date: { type: DataTypes.DATE }
  }, { sequelize, modelName: 'deadline' })

  Role.init({
    name: { type: DataTypes.STRING }
  }, { sequelize, modelName: 'role' })

  UserRole.init({}, {
    sequelize,
    modelName: 'userRole',
    tableName: 'user_roles',
    timestamps: false,
  })

  User.hasOne(Profile, { as: 'profile', foreignKey: 'userId' })
  Profile.belongsTo(User, { as: 'user', foreignKey: 'userId' })

  Project.hasMany(Deadline, { as: 'deadlines', foreignKey: 'projectId' })
  Deadline.belongsTo(Project, { as: 'project', foreignKey: 'projectId' })

  Project.belongsTo(User, { as: 'user', foreignKey: 'userId' })
  User.hasMany(Project, { as: 'projects', foreignKey: 'userId' })
  User.belongsToMany(Role, {
    through: UserRole,
    as: 'roles',
    foreignKey: 'userId',
    otherKey: 'roleId',
  })
  Role.belongsToMany(User, {
    through: UserRole,
    as: 'users',
    foreignKey: 'roleId',
    otherKey: 'userId',
  })

  return { Deadline, Profile, Project, Role, User, sequelize }
}

async function seedSequelize({
  Deadline,
  Profile,
  Project,
  Role,
  User,
  sequelize,
}: ReturnType<typeof configureORM>) {
  await sequelize.sync({ force: true })
  await User.bulkCreate(relationSeeds.users)
  await Profile.bulkCreate(relationSeeds.profiles)
  await Project.bulkCreate(relationSeeds.projects)
  await Deadline.bulkCreate(relationSeeds.deadlines)
  await Role.bulkCreate(relationSeeds.roles)
  await sequelize.getQueryInterface().bulkInsert('user_roles', relationSeeds.userRoles)
}
