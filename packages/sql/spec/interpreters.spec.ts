import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import { expect, spy } from './specHelper.ts'
import {
  createSqlInterpreter,
  eq,
  ne,
  lte,
  lt,
  gte,
  gt,
  exists,
  within,
  nin,
  and,
  not,
  or,
  nor,
  mod,
  regex,
  pg,
  elemMatch,
  oracle,
  mysql,
  mssql,
  type SqlQueryOptions,
  someRelation,
  noneRelation,
  everyRelation,
} from '../src/index.ts'

const options: SqlQueryOptions = {
  ...pg,
}

describe('Condition Interpreter', () => {
  describe('property mapping', () => {
    const interpret = createSqlInterpreter({ eq, and, some: someRelation })

    it('allows localField to translate model properties into database columns', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'displayName', 'Alice'),
        new Field('eq', 'legacy_column', null),
      ])
      const [sql, params] = interpret(condition, {
        ...pg,
        rootAlias: 'users',
        localField: (field, { escape }) => escape(field === 'displayName' ? 'display_name' : field),
      })

      expect(sql).to.equal('("users"."display_name" = $1 and "users"."legacy_column" is null)')
      expect(params).to.deep.equal(['Alice'])
      expect(condition.value[0].field).to.equal('displayName')
    })

    it('calls localField once with the original model property', () => {
      const localField = spy((field: string) => pg.escapeField(field === 'displayName' ? 'display_name' : field))
      const [sql] = interpret(new Field('eq', 'displayName', 'Ada'), {
        ...pg,
        localField,
      })

      expect(sql).to.equal('"display_name" = $1')
      expect(localField).to.have.been.called.once
      expect(localField).to.have.been.called.with('displayName')
    })

    it('resolves the same condition independently for each model', () => {
      const condition = new Field('eq', 'label', 'same value')
      const render = {
        ...pg,
        localField: (field: string, { escape, relationContext }: {
          escape(field: string): string;
          relationContext: unknown;
        }) => escape((relationContext as { label: string }).label ?? field),
      }
      const first = interpret(condition, render, { label: 'user_label' })[0]
      const second = interpret(condition, render, { label: 'project_label' })[0]

      expect(first).to.equal('"user_label" = $1')
      expect(second).to.equal('"project_label" = $1')
      expect(condition.field).to.equal('label')
    })

    it('allows localField to map fields of both root and nested models', () => {
      const user = { displayName: 'user_name', id: 'other_id' }
      const project = { displayName: 'project_title', id: 'other_project_id' }
      const deadline = { displayName: 'deadline_title' }
      const condition = new CompoundCondition('and', [
        new Field('eq', 'displayName', 'Alice'),
        new Field('some', 'projects', new CompoundCondition('and', [
          new Field('eq', 'displayName', 'Launch'),
          new Field('some', 'deadlines', new Field('eq', 'displayName', 'Tomorrow')),
        ])),
      ])
      const [sql, params] = interpret(condition, {
        ...pg,
        rootAlias: 'users',
        localField: (field, { escape, relationContext }) => escape(
          (relationContext as Record<string, string>)[field] ?? field,
        ),
        getRelationMetadata: name => ({
          parentField: 'id',
          relationField: name === 'projects' ? 'user_id' : 'project_id',
          relationTable: name,
          relationContext: name === 'projects' ? project : deadline,
        }),
      }, user)

      expect(sql).to.equal([
        '("users"."user_name" = $1 and EXISTS (SELECT 1 FROM "projects" as "projects_0"',
        'WHERE "users"."other_id" = "projects_0"."user_id"',
        'AND (("projects_0"."project_title" = $2 and EXISTS (SELECT 1 FROM "deadlines" as "deadlines_1"',
        'WHERE "projects_0"."other_project_id" = "deadlines_1"."project_id"',
        'AND ("deadlines_1"."deadline_title" = $3))))))',
      ].join(' '))
      expect(params).to.deep.equal(['Alice', 'Launch', 'Tomorrow'])
    })

    it('passes the prefixed field, escape helper, and current model context to localField', () => {
      const rootContext = { displayName: 'display_name' }
      const localField = spy((field: string) => pg.escapeField(
        field === 'profile.displayName' ? 'profile_display_name' : field,
      ))
      const mapped = createSqlInterpreter({ eq, elemMatch })
      const [sql, params] = mapped(
        new Field('elemMatch', 'profile', new Field('eq', 'displayName', 'Ada')),
        {
          ...pg,
          localField,
        },
        rootContext,
      )

      expect(sql).to.equal('"profile_display_name" = $1')
      expect(params).to.deep.equal(['Ada'])
      expect(localField).to.have.been.called.once
      expect(localField).to.have.been.called.with('profile.displayName', {
        escape: pg.escapeField,
        relationContext: rootContext,
      })
    })

    const scalarCases: [string, unknown, string][] = [
      ['eq', 'Ada', '"display_name" = $1'],
      ['ne', 'Ada', '"display_name" <> $1'],
      ['lt', 1, '"display_name" < $1'],
      ['lte', 1, '"display_name" <= $1'],
      ['gt', 1, '"display_name" > $1'],
      ['gte', 1, '"display_name" >= $1'],
      ['eq', null, '"display_name" is null'],
      ['ne', null, '"display_name" is not null'],
      ['exists', true, '"display_name" is not null'],
      ['exists', false, '"display_name" is null'],
      ['within', ['Ada', 'Lin'], '"display_name" in($1, $2)'],
      ['nin', ['Ada'], '"display_name" not in($1)'],
      ['mod', [2, 0], 'mod("display_name", $1) = $2'],
      ['regex', /Ada/i, '"display_name" ~* $1'],
    ]

    scalarCases.forEach(([operator, value, expectedSql]) => {
      it(`uses localField for ${operator} with ${String(value)}`, () => {
        const localField = spy(() => '"display_name"')
        const mapped = createSqlInterpreter({
          eq, ne, lt, lte, gt, gte, exists, within, nin, mod, regex,
        })
        const [sql] = mapped(new Field(operator, 'displayName', value), { ...pg, localField })

        expect(sql).to.equal(expectedSql)
        expect(localField).to.have.been.called.once
        expect(localField).to.have.been.called.with('displayName')
      })
    })

    it('allows custom builders to map parent and related fields through localField', () => {
      const mapped = createSqlInterpreter({ eq, some: someRelation })
      const parent = { tenantId: 'tenant_id' }
      const related = { ownerId: 'owner_id', id: 'physical_id' }
      const [sql] = mapped(new Field('some', 'records', new Field('eq', 'id', 1)), {
        ...pg,
        rootAlias: 'parents',
        localField: (field, { escape, relationContext }) => escape(
          (relationContext as Record<string, string>)[field] ?? field,
        ),
        getRelationMetadata: () => ({
          relationContext: related,
          buildRelationQuery: relation =>
            `SELECT 1 FROM "records" as "${relation.relationAlias}"` +
            ` WHERE ${relation.parentField('tenantId')} = ${relation.relationField('ownerId')}` +
            ` AND (${relation.conditionSql()})`,
        }),
      }, parent)

      expect(sql).to.contain('"parents"."tenant_id" = "records_0"."owner_id"')
      expect(sql).to.contain('"records_0"."physical_id" = $1')
    })

    it('passes each relation correlation field to localField with its model context', () => {
      const mapped = createSqlInterpreter({ eq, some: someRelation })
      const parent = { tenantId: 'tenant_id' }
      const related = { parentId: 'parent_id', displayName: 'display_name' }
      const localField = spy((field: string, { escape, relationContext }: {
        escape(field: string): string;
        relationContext: unknown;
      }) => escape((relationContext as Record<string, string>)[field] ?? field))
      const [sql] = mapped(new Field('some', 'records', new Field('eq', 'displayName', 'Ada')), {
        ...pg,
        rootAlias: 'parents',
        localField,
        getRelationMetadata: () => ({
          relationContext: related,
          relationTable: 'records',
          parentField: 'tenantId',
          relationField: 'parentId',
        }),
      }, parent)

      expect(sql).to.contain('"parents"."tenant_id" = "records_0"."parent_id"')
      expect(sql).to.contain('"records_0"."display_name" = $1')
      expect(localField).to.have.been.called.with('tenantId', {
        escape: pg.escapeField,
        relationContext: parent,
      })
      expect(localField).to.have.been.called.with('parentId', {
        escape: pg.escapeField,
        relationContext: related,
      })
    })
  })

  describe('primitive operators', () => {
    const interpret = createSqlInterpreter({ eq, ne, lt, lte, gt, gte, mod })

    it('generates query with `=` operator for "eq"', () => {
      const condition = new Field('eq', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} = $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<>` operator for "ne"', () => {
      const condition = new Field('ne', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} <> $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<` operator for "lt"', () => {
      const condition = new Field('lt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} < $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<=` operator for "lte"', () => {
      const condition = new Field('lte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} <= $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>` operator for "gt"', () => {
      const condition = new Field('gt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} > $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>=` operator for "gte"', () => {
      const condition = new Field('gte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} >= $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates call to `MOD` function for "mod"', () => {
      const condition = new Field('mod', 'qty', [4, 0])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('mod("qty", $1) = $2')
      expect(params).to.deep.equal([4, 0])
    })
  })

  describe('exists', () => {
    const interpret = createSqlInterpreter({ exists })

    it('generates query with `is not null` operator when value equals `true`', () => {
      const condition = new Field('exists', 'address', true)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} is not null`)
      expect(params).to.be.empty
    })

    it('generates query with `is null` operator when value equals `false`', () => {
      const condition = new Field('exists', 'address', false)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} is null`)
      expect(params).to.be.empty
    })
  })

  describe('in (within, nin)', () => {
    const interpret = createSqlInterpreter({ within, nin, and, eq })

    it('generates a separate placeholder for every element in the array', () => {
      const condition = new Field('within', 'age', [1, 2])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} in($1, $2)`)
      expect(params).to.deep.equal(condition.value)
    })

    it('correctly generates placeholders when combined with other operators', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'John'),
        new Field('within', 'age', [1, 2])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("name" = $1 and "age" in($2, $3))')
      expect(params).to.deep.equal(['John', 1, 2])
    })

    it('generates `not in` operator for "nin', () => {
      const condition = new Field('nin', 'age', [1, 2])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeField(condition.field)} not in($1, $2)`)
      expect(params).to.deep.equal(condition.value)
    })
  })

  describe('compound operators', () => {
    const interpret = createSqlInterpreter({ or, nor, not, and, eq, lt, gt })

    it('generates query with inverted condition for "not"', () => {
      const condition = new CompoundCondition('not', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 12),
          new Field('eq', 'age', 13),
        ])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('not (("age" = $1 or "age" = $2))')
      expect([12, 13]).to.deep.equal(params)
    })

    it('generates query combined by logical `and` for "and"', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("age" = $1 and "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('generates query combined by logical `or` for "or"', () => {
      const condition = new CompoundCondition('or', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('("age" = $1 or "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('generates inverted query combined by logical `or` for "nor"', () => {
      const condition = new CompoundCondition('nor', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true)
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal('not ("age" = $1 or "active" = $2)')
      expect(params).to.deep.equal([1, true])
    })

    it('properly adds brackets for complex compound condition', () => {
      const condition = new CompoundCondition('or', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 1),
          new Field('eq', 'age', 2),
        ]),
        new CompoundCondition('and', [
          new Field('gt', 'qty', 1),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('nor', [
          new Field('gt', 'qty', 10),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('not', [new CompoundCondition('and', [
          new Field('eq', 'active', false),
          new Field('gt', 'age', 18)
        ])])
      ])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal([
        '(("age" = $1 or "age" = $2)',
        'or ("qty" > $3 and "qty" < $4)',
        'or not ("qty" > $5 or "qty" < $6)',
        'or not (("active" = $7 and "age" > $8)))',
      ].join(' '))
      expect(params).to.deep.equal([1, 2, 1, 20, 10, 20, false, 18])
    })
  })

  describe('regex', () => {
    const interpret = createSqlInterpreter({ regex })

    it('generates posix operator for PostgreSQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...pg })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates posix operator for Oracle', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...oracle })

      expect(sql).to.equal('"email" ~ $1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('generates call to `REGEXP` function for MySQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, { ...mysql })

      expect(sql).to.equal('`email` regexp ? = 1')
      expect(params).to.deep.equal([condition.value.source])
    })

    it('throws exception for MSSQL as it does not support REGEXP', () => {
      const condition = new Field('regex', 'email', /@/)
      expect(() => {
        interpret(condition, { ...mssql })
      }).to.throw(/"regexp" operator is not supported in MSSQL/)
    })
  })

  describe('relation conditions', () => {
    const interpret = createSqlInterpreter({
      eq,
      some: someRelation,
      every: everyRelation,
      none: noneRelation
    })
    const condition = new Field('some', 'wallets', new Field('eq', 'balance', 5))

    it('generates EXISTS query for simple relation metadata', () => {
      const interpreterOptions: SqlQueryOptions = {
        ...options,
        rootAlias: 'users',
        getRelationMetadata: () => ({
          parentField: 'id',
          relationField: 'userId',
          relationTable: 'user_wallets',
        })
      }
      const [sql, params] = interpret(condition, interpreterOptions)

      expect(sql).to.equal('EXISTS (SELECT 1 FROM "user_wallets" as "wallets_0" WHERE "users"."id" = "wallets_0"."userId" AND ("wallets_0"."balance" = $1))')
      expect(params).to.deep.equal([5])
    })

    it('allows custom relation SQL to add parameters before nested condition SQL', () => {
      const interpreterOptions: SqlQueryOptions = {
        ...options,
        rootAlias: 'users',
        getRelationMetadata: () => ({
          buildRelationQuery(relation) {
            return `SELECT 1 FROM ${relation.escapeField('wallets')} as ${relation.escapeField(relation.relationAlias)}` +
            ` WHERE ${relation.parentField('id')} = ${relation.relationField('userId')}` +
            ` AND ${relation.relationField('kind')} = ${relation.param('primary')}` +
            ` AND (${relation.conditionSql()})`
          }
        })
      }
      const [sql, params] = interpret(condition, interpreterOptions)

      expect(sql).to.equal('EXISTS (SELECT 1 FROM "wallets" as "wallets_0" WHERE "users"."id" = "wallets_0"."userId" AND "wallets_0"."kind" = $1 AND ("wallets_0"."balance" = $2))')
      expect(params).to.deep.equal(['primary', 5])
    })
  })
})
