import { FieldCondition, buildAnd } from '@ucast/core'
import { Model, Sequelize, DataTypes } from 'sequelize'
import { createSequelizeInterpreter, interpret } from '../src/lib/sequelize.ts'
import { expect, linearize } from './specHelper.ts'
import { eq } from '../src/interpreters.ts'
import {
  expectedRelationNames,
  namesOf,
  relationConditions,
  relationSeeds
} from './relationTestsConfig.ts'

describe(createSequelizeInterpreter.name, () => {
  const orm = configureORM()
  const { Project, User, sequelize } = orm

  after(async () => {
    await sequelize.close()
  })

  it('maps a model property to its configured database column', () => {
    const query = interpret(new FieldCondition('eq', 'displayName', 'Ada'), orm.Profile)
    expect(query.where.val).to.contain(`"display_name" = ?`)
    expect(query.replacements).to.deep.equal(['Ada'])
  })

  it('maps a model property to its configured database column for related models', () => {
    const query = interpret(
      buildAnd([
        new FieldCondition('eq', 'displayName', 'Alice Profile'),
        new FieldCondition('some', 'user', new FieldCondition('eq', 'tenantId', 1))
      ]),
      orm.Profile,
      { alias: 'p' },
    )

    expect(query.where.val).to.equal(linearize`
      ("p"."display_name" = ? and EXISTS (
        SELECT 1
        FROM "users" as "user_ucast0"
        WHERE "p"."userId" = "user_ucast0"."id" AND "user_ucast0"."tenant_id" = ?
      ))
    `)
    expect(query.replacements).to.deep.equal(['Alice Profile', 1])
  })

  it('keeps unresolved fields as literal identifiers', () => {
    const run = createSequelizeInterpreter({ eq })
    const query = run(new FieldCondition('eq', 'legacy_column', 'Ada'), User)
    expect(query.where.val).to.contain(`"legacy_column" = ?`)
    expect(query.replacements).to.deep.equal(['Ada'])
  })

  it('reports unknown relations before producing SQL', () => {
    expect(() => interpret(
      new FieldCondition('some', 'missingRelation', new FieldCondition('eq', 'name', 'Ada')),
      User,
    )).to.throw('Relation metadata for "users.missingRelation" not found')
  })

  it('rejects unsupported database dialects', () => {
    const customSequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
    class AnyModel extends Model {
      static {
        AnyModel.init({}, { sequelize: customSequelize })
      }
    }
    customSequelize.getDialect = () => 'unsupported' as ReturnType<typeof customSequelize.getDialect>

    expect(() => interpret(new FieldCondition('eq', 'name', 'Ada'), AnyModel))
      .to.throw('Unsupported database dialect: unsupported')
  })

  it('uses the property name when attribute metadata has no column override', () => {
    const customSequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
    class AnyModel extends Model {
      static {
        AnyModel.init({
          name: { type: DataTypes.STRING },
          age: { type: DataTypes.INTEGER, field: 'years' }
        }, { sequelize: customSequelize, tableName: 'anyModel' })
      }
    }

    const query = interpret(new FieldCondition('eq', 'name', 'Ada'), AnyModel)
    expect(query.where.val).to.equal(`"anyModel"."name" = ?`)

    const anotherQuery = interpret(new FieldCondition('eq', 'age', 1), AnyModel)
    expect(anotherQuery.where.val).to.equal(`"anyModel"."years" = ?`)
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

    expect(query.where.val).to.equal(linearize`
      EXISTS (
        SELECT 1 FROM "projects" as "projects_ucast0"
        WHERE "users"."id" = "projects_ucast0"."userId"
          AND EXISTS (
            SELECT 1 FROM "deadlines" as "deadlines_ucast1"
            WHERE "projects_ucast0"."id" = "deadlines_ucast1"."projectId"
              AND "deadlines_ucast1"."date" = ?
          )
      )
    `)
    expect(query.replacements).to.deep.equal(['2026-06-28'])
  })

  it('uses the through table for BelongsToMany relations', () => {
    const condition = new FieldCondition(
      'some',
      'roles',
      new FieldCondition('eq', 'name', 'admin')
    )

    const query = interpret(condition, User)

    expect(query.where.val).to.equal(linearize`
      EXISTS (
        SELECT 1 FROM "roles" as "roles_ucast0"
          INNER JOIN "user_roles" as "roles_ucast0_through" ON "roles_ucast0"."id" = "roles_ucast0_through"."roleId"
        WHERE "users"."id" = "roles_ucast0_through"."userId"
          AND "roles_ucast0"."name" = ?
      )
    `)
    expect(query.replacements).to.deep.equal(['admin'])
  })

  describe('named replacements', () => {
    const cases = [
      {
        name: 'one parameter',
        condition: new FieldCondition('eq', 'name', 'Alice'),
        values: ['Alice'],
        names: ['Alice'],
      },
      {
        name: 'multiple parameters',
        condition: buildAnd([
          new FieldCondition('eq', 'name', 'Alice'),
          new FieldCondition('eq', 'tenantId', 'tenant-a'),
        ]),
        values: ['Alice', 'tenant-a'],
        names: ['Alice'],
      },
      {
        name: 'nested relations',
        condition: buildAnd([
          new FieldCondition('eq', 'tenantId', 'tenant-a'),
          new FieldCondition('some', 'projects', buildAnd([
            new FieldCondition('eq', 'name', 'Launch'),
            new FieldCondition('some', 'deadlines', new FieldCondition('eq', 'id', 1)),
          ])),
        ]),
        values: ['tenant-a', 'Launch', 1],
        names: ['Alice'],
      },
    ]

    for (const testCase of cases) {
      it(`matches placeholder names to replacement keys for ${testCase.name}`, () => {
        const query = interpret(testCase.condition, User, { replacementMode: 'named' })
        const placeholders = (query.where.val as string).match(/:ucast_\d+_\d+/g)!
          .map(name => name.slice(1))

        expect(Object.keys(query.replacements)).to.deep.equal(placeholders)
        expect(Object.values(query.replacements)).to.deep.equal(testCase.values)
      })
    }
  })

  describe('e2e execution', () => {
    before(async () => {
      await seedSequelize(orm)
      await User.create({ id: 4, tenantId: 'tenant-b', name: 'Dana' })
    })

    for (const relationType of ['hasMany', 'belongsTo', 'hasOne', 'manyToMany'] as const) {
      it(`filters ${relationType} relations with findAll`, async () => {
        const Model = relationType === 'belongsTo' ? Project : User
        const query = interpret(relationConditions[relationType], Model, { alias: Model.name })
        const records = await Model.findAll({ ...query })

        expect(namesOf(records)).to.deep.equal(expectedRelationNames[relationType])
      })
    }

    for (const testCase of [
      { operator: 'some', expected: ['Alice', 'Bob'] },
      { operator: 'none', expected: ['Carol', 'Dana'] },
      { operator: 'every', expected: ['Bob', 'Dana'] },
    ]) {
      it(`evaluates ${testCase.operator} including parents without related rows`, async () => {
        const condition = new FieldCondition(
          testCase.operator,
          'projects',
          new FieldCondition('eq', 'active', true),
        )
        const records = await User.findAll({ ...interpret(condition, User, { alias: User.name }) })

        expect(namesOf(records)).to.deep.equal(testCase.expected)
      })
    }
  })
})

function configureORM() {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
  })

  class User extends Model {
    declare name: string

    static {
      User.init({
        tenantId: { type: DataTypes.STRING, field: 'tenant_id' },
        name: { type: DataTypes.STRING },
        email: { type: DataTypes.STRING },
      }, { sequelize, modelName: 'user' })
    }
  }

  class Profile extends Model {
    static {
      Profile.init({
        displayName: { type: DataTypes.STRING, field: 'display_name' },
      }, { sequelize, modelName: 'profile' })
    }
  }

  class Project extends Model {
    declare name: string

    static {
      Project.init({
        name: { type: DataTypes.STRING },
        active: { type: DataTypes.BOOLEAN }
      }, { sequelize, modelName: 'project' })
    }
  }

  class Deadline extends Model {
    static {
      Deadline.init({
        date: { type: DataTypes.DATE }
      }, { sequelize, modelName: 'deadline' })
    }
  }

  class Role extends Model {
    static {
      Role.init({
        name: { type: DataTypes.STRING },
        displayName: { type: DataTypes.STRING, field: 'display_name' },
      }, { sequelize, modelName: 'role' })
    }
  }

  class UserRole extends Model {
    static {
      UserRole.init({}, {
        sequelize,
        modelName: 'userRole',
        tableName: 'user_roles',
        timestamps: false,
      })
    }
  }

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
