import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import { expect, spy } from './specHelper.ts'
import {
  createSqlInterpreter,
  createDefaultSqlComposer,
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
  ilike,
  like,
  sqlite,
  pg,
  oracle,
  mysql,
  mssql,
  type SqlQueryOptions,
  someRelation,
  noneRelation,
  everyRelation,
  type SqlComposer,
  type SqlEntityMetadata,
} from '../src/index.ts'

const options: SqlQueryOptions = {
  ...pg,
}

describe('Condition Interpreter', () => {
  describe('primitive operators', () => {
    const interpret = createSqlInterpreter({ eq, ne, lt, lte, gt, gte, mod })

    it('generates query with `=` operator for "eq"', () => {
      const condition = new Field('eq', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} = $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates `is null` for "eq" when value = null', () => {
      const condition = new Field('eq', 'name', null)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} is null`)
      expect(params).to.have.lengthOf(0)
    })

    it('generates query with `<>` operator for "ne"', () => {
      const condition = new Field('ne', 'name', 'test')
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} <> $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates `is not null` for "ne" when value = null', () => {
      const condition = new Field('ne', 'name', null)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} is not null`)
      expect(params).to.have.lengthOf(0)
    })

    it('generates query with `<` operator for "lt"', () => {
      const condition = new Field('lt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} < $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `<=` operator for "lte"', () => {
      const condition = new Field('lte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} <= $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>` operator for "gt"', () => {
      const condition = new Field('gt', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} > $1`)
      expect(params).to.deep.equal([condition.value])
    })

    it('generates query with `>=` operator for "gte"', () => {
      const condition = new Field('gte', 'age', 10)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} >= $1`)
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

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} is not null`)
      expect(params).to.be.empty
    })

    it('generates query with `is null` operator when value equals `false`', () => {
      const condition = new Field('exists', 'address', false)
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} is null`)
      expect(params).to.be.empty
    })
  })

  describe('in (within, nin)', () => {
    const interpret = createSqlInterpreter({ within, nin, and, eq })

    it('generates a separate placeholder for every element in the array', () => {
      const condition = new Field('within', 'age', [1, 2])
      const [sql, params] = interpret(condition, options)

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} in($1, $2)`)
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

      expect(sql).to.equal(`${options.escapeIdentifier(condition.field)} not in($1, $2)`)
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

    it('generates case-insensitive posix operator', () => {
      const [sql, params] = interpret(new Field('regex', 'email', /pattern/i), pg)

      expect(sql).to.equal('"email" ~* $1')
      expect(params).to.deep.equal(['pattern'])
    })

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

    const regexpLikeCases: [RegExp, string][] = [
      [/pattern/, 'c'],
      [/pattern/i, 'i'],
      [/^pattern$/m, 'cm'],
      [/a.b/s, 'cs'],
      [/^a.b$/ims, 'ims'],
      [/pattern/guy, 'c'],
    ]

    regexpLikeCases.forEach(([pattern, flags]) => {
      it(`generates MSSQL REGEXP_LIKE for ${pattern} with flags ${flags}`, () => {
        const [sql, params] = interpret(new Field('regex', 'email', pattern), mssql)

        expect(sql).to.equal('REGEXP_LIKE([email], ?, ?)')
        expect(params).to.deep.equal([pattern.source, flags])
      })
    })

    it('binds MSSQL regex patterns without changing the expression or its state', () => {
      const pattern = /O'Reilly\d+|--/gi
      pattern.lastIndex = 4
      const condition = new Field('regex', 'displayName', pattern)
      const [sql, params] = interpret(condition, {
        ...mssql,
        alias: 'users',
        metadata: { toColumnName: () => 'display_name' },
      })

      expect(sql).to.equal('REGEXP_LIKE([users].[display_name], ?, ?)')
      expect(params).to.deep.equal([String.raw`O'Reilly\d+|--`, 'i'])
      expect(condition.value).to.equal(pattern)
      expect(pattern.lastIndex).to.equal(4)
    })

    it('preserves MSSQL parameter ordering when regex predicates are composed and negated', () => {
      const interpret = createSqlInterpreter({ eq, regex, and, not })
      const condition = new CompoundCondition('and', [
        new Field('eq', 'active', true),
        new CompoundCondition('not', [new Field('regex', 'email', /@example\.com$/i)]),
        new Field('regex', 'name', /^Ada/),
      ])
      const [sql, params] = interpret(condition, {
        ...mssql,
        paramPlaceholder: index => `@p${index}`,
      })

      expect(sql).to.equal(
        '([active] = @p1 and not (REGEXP_LIKE([email], @p2, @p3)) ' +
        'and REGEXP_LIKE([name], @p4, @p5))'
      )
      expect(params).to.deep.equal([true, String.raw`@example\.com$`, 'i', '^Ada', 'c'])
    })

    it('uses a configured regexp strategy for MSSQL', () => {
      const condition = new Field('regex', 'email', /@/)
      const [sql, params] = interpret(condition, {
        ...mssql,
        features: { ...mssql.features, regex: { use: 'regexp' } },
      })

      expect(sql).to.equal('[email] regexp ? = 1')
      expect(params).to.deep.equal([condition.value.source])
    })
  })

  describe('like', () => {
    const interpret = createSqlInterpreter({ like })

    it('uses PostgreSQL placeholders and an explicit backslash escape', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'Alice%'), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['Alice%'])
    })

    it('uses MySQL identifiers and CHAR(92) as the escape character', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'Alice%'), mysql)

      expect(sql).to.equal('`name` LIKE ? ESCAPE char(92)')
      expect(params).to.deep.equal(['Alice%'])
    })

    it('uses SQLite identifiers and positional parameters', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'Alice%'), sqlite)

      expect(sql).to.equal('"name" LIKE ? ESCAPE char(92)')
      expect(params).to.deep.equal(['Alice%'])
    })

    it('uses Oracle placeholders and a backslash escape literal', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'Alice%'), oracle)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE '\'`)
      expect(params).to.deep.equal(['Alice%'])
    })

    it('uses MSSQL identifiers and a backslash escape literal', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'Alice%'), mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal(['Alice%'])
    })

    it('preserves percent and underscore wildcards in the bound pattern', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'A_ice%'), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['A_ice%'])
    })

    it('preserves an escaped underscore followed by a wildcard', () => {
      const [sql, params] = interpret(new Field('like', 'name', String.raw`Alice\_%`), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal([String.raw`Alice\_%`])
    })

    it('preserves an escaped percent followed by a wildcard', () => {
      const [sql, params] = interpret(new Field('like', 'discount', String.raw`50\%%`), pg)

      expect(sql).to.equal(String.raw`"discount" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal([String.raw`50\%%`])
    })

    it('accepts an empty pattern', () => {
      const [sql, params] = interpret(new Field('like', 'name', ''), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal([''])
    })

    it('accepts a pattern containing only a wildcard', () => {
      const [sql, params] = interpret(new Field('like', 'name', '%'), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['%'])
    })

    it('accepts a trailing escaped backslash', () => {
      const [sql, params] = interpret(new Field('like', 'path', String.raw`docs\\`), pg)

      expect(sql).to.equal(String.raw`"path" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal([String.raw`docs\\`])
    })

    it('leaves regular-expression metacharacters unchanged', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'a.b+[cd](e)?^$'), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['a.b+[cd](e)?^$'])
    })

    it('binds quotes and SQL-looking text as a value', () => {
      const [sql, params] = interpret(new Field('like', 'name', "O'Reilly'; --%"), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(["O'Reilly'; --%"])
    })

    it('preserves line breaks in the pattern', () => {
      const [sql, params] = interpret(new Field('like', 'name', 'first\nsecond%'), pg)

      expect(sql).to.equal(String.raw`"name" LIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['first\nsecond%'])
    })

    it('escapes opening brackets for MSSQL without changing the condition', () => {
      const condition = new Field('like', 'name', '[Alice]%')
      Object.freeze(condition)
      const [sql, params] = interpret(condition, mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal([String.raw`\[Alice]%`])
      expect(condition.value).to.equal('[Alice]%')
    })

    it('preserves an already escaped MSSQL opening bracket', () => {
      const [sql, params] = interpret(new Field('like', 'name', String.raw`\[Alice]%`), mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal([String.raw`\[Alice]%`])
    })

    it('escapes each opening bracket in an MSSQL pattern', () => {
      const [sql, params] = interpret(new Field('like', 'name', '[A][B]%'), mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal([String.raw`\[A]\[B]%`])
    })

    it('escapes an MSSQL opening bracket after an escaped backslash', () => {
      const [sql, params] = interpret(new Field('like', 'name', String.raw`\\[Alice]%`), mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal([String.raw`\\\[Alice]%`])
    })

    it('leaves a standalone MSSQL closing bracket unchanged', () => {
      const [sql, params] = interpret(new Field('like', 'name', ']Alice%'), mssql)

      expect(sql).to.equal(String.raw`[name] LIKE ? ESCAPE '\'`)
      expect(params).to.deep.equal([']Alice%'])
    })

    it('uses mapped, aliased columns and a configured escape expression', () => {
      const [sql, params] = interpret(new Field('like', 'displayName', 'Alice%'), {
        ...pg,
        alias: 'users',
        metadata: { toColumnName: () => 'display_name' },
        features: { ...pg.features, like: { use: 'native', escapeCharacter: 'char(92)' } },
      })

      expect(sql).to.equal('"users"."display_name" LIKE $1 ESCAPE char(92)')
      expect(params).to.deep.equal(['Alice%'])
    })

    it('rejects a null pattern', () => {
      const condition = new Field('like', 'name', null)

      expect(() => interpret(condition, pg)).to.throw('LIKE pattern must be a string')
    })

    it('rejects an undefined pattern', () => {
      const condition = new Field('like', 'name', undefined)

      expect(() => interpret(condition, pg)).to.throw('LIKE pattern must be a string')
    })

    it('rejects a numeric pattern', () => {
      const condition = new Field('like', 'name', 42)

      expect(() => interpret(condition, pg)).to.throw('LIKE pattern must be a string')
    })

    it('rejects a RegExp instead of treating it as a LIKE pattern', () => {
      const condition = new Field('like', 'name', /Alice/)

      expect(() => interpret(condition, pg)).to.throw('LIKE pattern must be a string')
    })

    it('rejects an array of patterns', () => {
      const condition = new Field('like', 'name', ['Alice%'])

      expect(() => interpret(condition, pg)).to.throw('LIKE pattern must be a string')
    })

    it('rejects a trailing unpaired backslash', () => {
      const condition = new Field('like', 'name', 'Alice\\')

      expect(() => interpret(condition, pg))
        .to.throw('LIKE pattern must not end with an unpaired backslash')
    })

    it('rejects an unpaired backslash after an escaped backslash', () => {
      const condition = new Field('like', 'name', 'Alice\\\\\\')

      expect(() => interpret(condition, pg))
        .to.throw('LIKE pattern must not end with an unpaired backslash')
    })
  })

  describe('ilike', () => {
    const interpret = createSqlInterpreter({ ilike })
    const cases: [string, SqlQueryOptions, string][] = [
      ['MySQL', mysql, 'LOWER(`name`) LIKE LOWER(?) ESCAPE char(92)'],
      ['SQLite', sqlite, 'LOWER("name") LIKE LOWER(?) ESCAPE char(92)'],
      ['Oracle', oracle, String.raw`LOWER("name") LIKE LOWER($1) ESCAPE '\'`],
      ['MSSQL', mssql, String.raw`LOWER([name]) LIKE LOWER(?) ESCAPE '\'`],
    ]

    cases.forEach(([dialect, options, expectedSql]) => {
      it(`lowercases both operands in SQL for ${dialect} and binds the original pattern`, () => {
        const condition = new Field('ilike', 'name', String.raw`Ab\_%`)
        const [sql, params] = interpret(condition, options)

        expect(sql).to.equal(expectedSql)
        expect(params).to.deep.equal([String.raw`Ab\_%`])
        expect(condition.value).to.equal(String.raw`Ab\_%`)
      })
    })

    it('uses native ILIKE for PostgreSQL', () => {
      const [sql, params] = interpret(new Field('ilike', 'name', 'Ab%'), pg)

      expect(sql).to.equal(String.raw`"name" ILIKE $1 ESCAPE E'\\'`)
      expect(params).to.deep.equal(['Ab%'])
    })

    it('applies the lower strategy override to mapped, aliased columns', () => {
      const [sql, params] = interpret(new Field('ilike', 'displayName', 'Ab%'), {
        ...pg,
        features: { ...pg.features, ilike: { use: 'lower' } },
        alias: 'users',
        metadata: { toColumnName: () => 'display_name' },
      })

      expect(sql).to.equal(String.raw`LOWER("users"."display_name") LIKE LOWER($1) ESCAPE E'\\'`)
      expect(params).to.deep.equal(['Ab%'])
    })

    it('preserves MSSQL bracket escaping before database case folding', () => {
      const condition = new Field('ilike', 'name', String.raw`Ab[CD]\_%`)
      const [sql, params] = interpret(condition, mssql)

      expect(sql).to.equal(String.raw`LOWER([name]) LIKE LOWER(?) ESCAPE '\'`)
      expect(params).to.deep.equal([String.raw`Ab\[CD]\_%`])
      expect(condition.value).to.equal(String.raw`Ab[CD]\_%`)
    })
  })

  describe('property mapping', () => {
    const interpret = createSqlInterpreter({ eq, and, some: someRelation })

    it('isolates child metadata and preserves parent mapping after a relation', () => {
      const condition = new CompoundCondition('and', [
        new Field('some', 'projects', new Field('eq', 'displayName', 'Launch')),
        new Field('eq', 'displayName', 'Alice'),
      ])
      const [sql, params] = interpret(condition, {
        ...pg,
        alias: 'users',
        metadata: {
          toColumnName: name => `user_${name}`,
          resolveRelation: () => ({
            relatedTable: 'projects',
            ownField: 'user_id',
            relatedField: 'userId',
            metadata: {},
          }),
        },
      })

      expect(sql).to.equal(
        '(EXISTS (SELECT 1 FROM "projects" as "projects_ucast0" ' +
        'WHERE "users"."user_id" = "projects_ucast0"."userId" ' +
        'AND "projects_ucast0"."displayName" = $1) and "users"."user_displayName" = $2)'
      )
      expect(params).to.deep.equal(['Launch', 'Alice'])
    })

    it('allows `toColumnName` to translate model properties into database columns', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'displayName', 'Alice'),
        new Field('eq', 'legacy_column', null),
      ])
      const toColumnName = spy((name: string) => ({ displayName: 'display_name' })[name] ?? name)
      const [sql, params] = interpret(condition, {
        ...pg,
        alias: 'users',
        metadata: { toColumnName }
      })

      expect(sql).to.equal('("users"."display_name" = $1 and "users"."legacy_column" is null)')
      expect(params).to.deep.equal(['Alice'])
      expect(toColumnName).to.have.been.called.exactly(2)
      expect(toColumnName).to.have.been.called.with('displayName')
      expect(toColumnName).to.have.been.called.with('legacy_column')
    })

    it('calls `toColumnName` corresponding to its entity', () => {
      const userColumns: Record<string, string> = { displayName: 'user_name', id: 'other_id' }
      const projectColumns: Record<string, string> = { displayName: 'project_title', id: 'other_project_id', userId: 'user_id' }
      const deadlineColumns: Record<string, string> = { displayName: 'deadline_title', projectId: 'project_id' }
      const condition = new CompoundCondition('and', [
        new Field('eq', 'displayName', 'Alice'),
        new Field('some', 'projects', new CompoundCondition('and', [
          new Field('eq', 'displayName', 'Launch'),
          new Field('some', 'deadlines', new Field('eq', 'displayName', 'Tomorrow')),
        ])),
      ])
      const [sql, params] = interpret(condition, {
        ...pg,
        alias: 'users',
        metadata: {
          toColumnName: (field) => userColumns[field],
          resolveRelation: () => ({
            relatedTable: 'projects',
            relatedField: 'user_id',
            ownField: 'other_id',
            metadata: {
              toColumnName: (field) => projectColumns[field],
              resolveRelation: () => ({
                relatedTable: 'deadlines',
                ownField: 'other_project_id',
                relatedField: 'project_id',
                metadata: {
                  toColumnName: (name) => deadlineColumns[name],
                }
              })
            }
          })
        }
      })

      expect(sql).to.equal(
        '("users"."user_name" = $1 and EXISTS (' +
        'SELECT 1 FROM "projects" as "projects_ucast0" WHERE "users"."other_id" = "projects_ucast0"."user_id" ' +
        'AND ' +
        '("projects_ucast0"."project_title" = $2 and EXISTS (' +
        'SELECT 1 FROM "deadlines" as "deadlines_ucast1" WHERE "projects_ucast0"."other_project_id" = "deadlines_ucast1"."project_id" ' +
        'AND "deadlines_ucast1"."deadline_title" = $3))))'
      )
      expect(params).to.deep.equal(['Alice', 'Launch', 'Tomorrow'])
    })
  })

  describe('relation operators', () => {
    const interpret = createSqlInterpreter({
      eq,
      and,
      some: someRelation,
      none: noneRelation,
      every: everyRelation
    })
    const relationOptions: SqlQueryOptions = {
      ...pg,
      alias: 'users',
      metadata: {
        resolveRelation: name => name === 'projects' ? {
          relatedTable: 'project',
          ownField: 'id',
          relatedField: 'userId',
          metadata: {},
        } : undefined,
      },
    }

    it('generates EXISTS condition for "some" operator', () => {
      const [sql, params] = interpret(new Field('some', 'projects', new Field('eq', 'active', true)), relationOptions)

      expect(sql).to.equal(
        'EXISTS (SELECT 1 FROM "project" as "projects_ucast0" ' +
        'WHERE "users"."id" = "projects_ucast0"."userId" AND "projects_ucast0"."active" = $1)'
      )
      expect(params).to.deep.equal([true])
    })

    it('generates NOT EXISTS for "none" operator', () => {
      const [sql, params] = interpret(new Field('none', 'projects', new Field('eq', 'active', true)), relationOptions)

      expect(sql).to.equal(
        'NOT EXISTS (SELECT 1 FROM "project" as "projects_ucast0" ' +
        'WHERE "users"."id" = "projects_ucast0"."userId" AND "projects_ucast0"."active" = $1)'
      )
      expect(params).to.deep.equal([true])
    })

    it('generates NOT EXISTS with an inverted predicate for "every" operator', () => {
      const condition = new Field('every', 'projects', new CompoundCondition('and', [
        new Field('eq', 'active', true),
        new Field('eq', 'status', 'published'),
      ]))
      const [sql, params] = interpret(condition, relationOptions)

      expect(sql).to.equal(
        'NOT EXISTS (SELECT 1 FROM "project" as "projects_ucast0" ' +
        'WHERE "users"."id" = "projects_ucast0"."userId" ' +
        'AND NOT (("projects_ucast0"."active" = $1 and "projects_ucast0"."status" = $2)))'
      )
      expect(params).to.deep.equal([true, 'published'])
    })

    it('throws exception if relation cannot be found', () => {
      const condition = new Field('some', 'missing', new Field('eq', 'active', true))

      expect(() => interpret(condition, relationOptions)).to.throw('Relation metadata for "users.missing" not found')
      expect(() => interpret(condition, pg)).to.throw('Relation metadata for "missing" not found')
    })

    it('joins every composite column through a junction without remapping physical names', () => {
      const condition = new Field('some', 'roles', new Field('eq', 'name', 'admin'))
      const [sql, params] = interpret(condition, {
        ...pg,
        alias: 'users',
        metadata: {
          toColumnName: name => `wrong_${name}`,
          resolveRelation: () => ({
            relatedTable: 'roles',
            ownField: ['tenant_id', 'id'],
            relatedField: ['tenant_id', 'id'],
            through: {
              table: 'user_roles',
              ownRelationField: ['user_tenant', 'user_id'],
              relatedRelationField: ['role_tenant', 'role_id'],
            },
            metadata: { toColumnName: name => name === 'name' ? 'display_name' : `wrong_${name}` },
          }),
        },
      })

      expect(sql).to.equal(
        'EXISTS (SELECT 1 FROM "roles" as "roles_ucast0" ' +
        'INNER JOIN "user_roles" as "roles_ucast0_through" ' +
        'ON "roles_ucast0"."tenant_id" = "roles_ucast0_through"."role_tenant" ' +
        'AND "roles_ucast0"."id" = "roles_ucast0_through"."role_id" ' +
        'WHERE "users"."tenant_id" = "roles_ucast0_through"."user_tenant" ' +
        'AND "users"."id" = "roles_ucast0_through"."user_id" ' +
        'AND "roles_ucast0"."display_name" = $1)'
      )
      expect(params).to.deep.equal(['admin'])
    })

    it('rejects empty and mismatched composite join columns', () => {
      const condition = new Field('some', 'projects', new Field('eq', 'active', true))
      for (const ownField of [[], ['tenant_id', 'id']]) {
        expect(() => interpret(condition, {
          ...relationOptions,
          metadata: {
            resolveRelation: () => ({
              relatedTable: 'projects',
              ownField,
              relatedField: ['user_id'],
              metadata: {},
            }),
          },
        })).to.throw('Relation join columns must be nonempty and have matching lengths')
      }
    })

    it('lets a custom composer append relation parameters after the eager predicate', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'Alice'),
        new Field('some', 'projects', new Field('eq', 'active', true)),
        new Field('eq', 'enabled', true),
      ])
      const customInterpret = createSqlInterpreter({ eq, and, some: someRelation }, {
        createSqlComposer(options) {
          const composer = createDefaultSqlComposer(options)
          const defaultRelation = composer.relation
          composer.relation = name => {
            const related = defaultRelation(name)
            return {
              composer: related.composer,
              subquery: predicate => related.subquery(
                composer.sql`(${predicate}) AND kind = ${composer.param('owned')}`
              ),
            }
          }
          return composer
        },
      })
      const [sql, params] = customInterpret(condition, { ...relationOptions, ...mysql })

      expect(sql).to.equal(
        '(`users`.`name` = ? and EXISTS (SELECT 1 FROM `project` as `projects_ucast0` ' +
        'WHERE `users`.`id` = `projects_ucast0`.`userId` AND (`projects_ucast0`.`active` = ?) ' +
        'AND kind = ?) and `users`.`enabled` = ?)'
      )
      expect(params).to.deep.equal(['Alice', true, 'owned', true])
    })

    it('uses distinct aliases for nested relations with the same name', () => {
      const metadata: SqlEntityMetadata = {
        resolveRelation: () => ({
          relatedTable: 'nodes',
          ownField: 'id',
          relatedField: 'parentId',
          metadata,
        }),
      }
      const condition = new Field('some', 'children',
        new Field('some', 'children', new Field('eq', 'active', true)))
      const [sql, params] = interpret(condition, { ...pg, alias: 'nodes', metadata })

      expect(sql).to.equal(
        'EXISTS (SELECT 1 FROM "nodes" as "children_ucast0" ' +
        'WHERE "nodes"."id" = "children_ucast0"."parentId" AND ' +
        'EXISTS (SELECT 1 FROM "nodes" as "children_ucast1" ' +
        'WHERE "children_ucast0"."id" = "children_ucast1"."parentId" ' +
        'AND "children_ucast1"."active" = $1))'
      )
      expect(params).to.deep.equal([true])
      expect(interpret(condition, { ...pg, alias: 'nodes', metadata })).to.deep.equal([sql, params])
    })
  })

  describe('SQL interpreter', () => {
    it('creates a composer for each call with query options and finalizes the fragment', () => {
      const composers: SqlComposer<string>[] = []
      const result = spy((fragment: string) => ({ sql: fragment }))
      const createSqlComposer = spy((sqlOptions: SqlQueryOptions) => {
        const composer = { ...createDefaultSqlComposer(sqlOptions), result }
        composers.push(composer)
        return composer
      })
      const interpret = createSqlInterpreter({ eq }, { createSqlComposer })
      const condition = new Field('eq', 'name', 'Ada')

      expect(interpret(condition, options)).to.deep.equal({ sql: '"name" = $1' })
      expect(interpret(condition, options)).to.deep.equal({ sql: '"name" = $1' })
      expect(createSqlComposer).to.have.been.called.exactly(2)
      expect(createSqlComposer).to.have.been.called.with.exactly(options)
      expect(composers[0]).not.to.equal(composers[1])
      expect(result).to.have.been.called.exactly(2)
      expect(result).to.have.been.called.with.exactly('"name" = $1')
    })

    it('returns non-string compound fragments directly when the composer has no result method', () => {
      type Fragment = { text: string }
      const composer: SqlComposer<Fragment> = {
        field: name => ({ text: name }),
        param: () => ({ text: '?' }),
        manyParams: () => { throw new Error('not used') },
        relation: () => { throw new Error('not used') },
        features: pg.features,
        raw: text => ({ text }),
        join: (fragments, separator) => ({
          text: fragments.map(fragment => fragment.text).join(separator.text),
        }),
        sql: (strings, ...values) => ({
          text: strings.reduce((text, part, index) => text + (index ? (values[index - 1] as Fragment).text : '') + part, ''),
        }),
      }
      const interpret = createSqlInterpreter<Fragment, Fragment>({ eq, and }, {
        createSqlComposer: () => composer,
      })
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'Ada'),
        new Field('eq', 'active', true),
      ])

      expect(interpret(condition, options)).to.deep.equal({ text: '(name = ? and active = ?)' })
    })

    it('uses `getInterpreterName` to detect interpreter name from condition', () => {
      const interpret = createSqlInterpreter({
        $eq: (_condition, { sql, param }) => sql`chosen = ${param('empty')}`,
      }, {
        getInterpreterName: (condition) => `$${condition.operator}`,
      })
      const [sql, params] = interpret(new Field('eq', 'unused', 1), pg)
      expect(sql).to.equal('chosen = $1')
      expect(params).to.deep.equal(['empty'])
    })

    it('starts a fresh default parameter sequence on every interpretation', () => {
      const interpret = createSqlInterpreter({ eq, and, someRelation })
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'Ada'),
        new Field('eq', 'role', 'admin'),
      ])
      const sqlOptions: SqlQueryOptions = {
        ...pg,
        alias: 'users',
      }
      const first = interpret(condition, sqlOptions)
      const second = interpret(condition, sqlOptions)

      expect(first).to.deep.equal(second)
      expect(first[0]).to.contain(' $1')
      expect(first[0]).to.contain(' $2')
      expect(first[1]).to.deep.equal(['Ada', 'admin'])
    })
  })
})
