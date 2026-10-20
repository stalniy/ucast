# UCAST SQL

[![@ucast/sql NPM version](https://badge.fury.io/js/%40ucast%2Fsql.svg)](https://badge.fury.io/js/%40ucast%2Fsql)
[![](https://img.shields.io/npm/dm/%40ucast%2Fsql.svg)](https://www.npmjs.com/package/%40ucast%2Fsql)

This package is a part of [ucast] ecosystem. It provides an interpreter that can translate ucast conditions into [SQL query](https://en.wikipedia.org/wiki/SQL).

[ucast]: https://github.com/stalniy/ucast

## Installation

```sh
npm i @ucast/sql
# or
yarn add @ucast/sql
# or
pnpm add @ucast/sql
```

## Getting Started

### Interpret conditions AST

In order to interpret something, we need 2 things: interpreter and AST. It's really easy to create interpreter just pick operators you want to use or pass all of them:

```js
import {
  createSqlInterpreter,
  eq,
  lt,
  lte,
  allInterpreters
} from '@ucast/sql';

const interpret = createSqlInterpreter({ eq, lt, lte });
// or
const interpret = createSqlInterpreter(allInterpreters);
```

`interpret` is a function that takes 2 parameters:

1. `condition`, the UCAST condition to interpret.
2. `options`, SQL dialect options with optional `alias` and entity `metadata`.

By default, it returns `[sql, params]`: a SQL predicate and its bound values.
The caller adds the predicate to a query and passes the parameters to the database
client. Each call starts with fresh parameters and relation aliases.

For the sake of an example, we will create AST manually using `Condition` from `@ucast/core`:

```js
import { CompoundCondition, FieldCondition } from '@ucast/core';

// x > 5 && y < 10
const condition = new CompoundCondition('and', [
  new FieldCondition('gt', 'x', 5),
  new FieldCondition('lt', 'y', 10),
]);
```

Now, we can combine these 2 together to get SQL condition:

```js
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { createSqlInterpreter, allInterpreters, pg } from '@ucast/sql';

// x > 5 && y < 10
const condition = new CompoundCondition('and', [
  new FieldCondition('gt', 'x', 5),
  new FieldCondition('lt', 'y', 10),
]);
const interpret = createSqlInterpreter(allInterpreters);

const [sql, replacements] = interpret(condition, {
  ...pg
})

console.log(sql) // ("x" > $1 and "y" < $2)
console.log(replacements) // [5, 10]
```

### Supported operators

`allInterpreters` registers these condition operators:

| Operator | SQL behavior |
| --- | --- |
| `eq`, `ne` | `=`, `<>`; `null` becomes `is null`, `is not null` |
| `lt`, `lte`, `gt`, `gte` | `<`, `<=`, `>`, `>=` |
| `exists` | `is not null` for a truthy value, `is null` otherwise |
| `in` (also `within`), `nin` | `in(...)`, `not in(...)`, with one parameter per value |
| `mod` | `mod(field, divisor) = remainder`, with both values bound |
| `regex` | Dialect-specific regular expression comparison with the pattern bound |
| `and`, `or` | Parenthesized conditions joined by `and` or `or` |
| `not`, `nor` | Negated groups joined by `and` or `or`, respectively |
| `some`, `none`, `every` | Correlated relation subqueries |

The exported function for `in` is named `within`. The relation functions are
exported as `someRelation`, `noneRelation`, and `everyRelation`; `allInterpreters`
registers them under `some`, `none`, and `every`.

### Map model properties to database columns

Use `metadata.toColumnName` to translate a model property into a column name.
Return an unescaped name; the composer escapes it and applies the query `alias`.
Without this callback, field names are used as column names directly.

```ts
const columns: Record<string, string> = { displayName: 'display_name' };
const condition = new FieldCondition('eq', 'displayName', 'Alice');

const [sql, params] = interpret(condition, {
  ...pg,
  alias: 'users',
  metadata: {
    toColumnName: name => columns[name] ?? name,
  },
});

// sql: '"users"."display_name" = $1'
// params: ['Alice']
```

Each relation has its own metadata. Conditions and join fields use the mapping
for their corresponding entity.

### Conditions on related tables

Use `some`, `none`, and `every` to express conditions against related records:

* `some` checks that at least one related record matches the condition.
* `none` checks that no related records match the condition.
* `every` checks that no related record makes the negated condition true.

`every` uses SQL negation, including SQL's usual NULL behavior. Both `none` and
`every` match when there are no related records.

When using the default composer, provide `metadata.resolveRelation` to describe
how the current table connects to the related table. Use an `alias` that matches
the outer query so the subquery can refer to its columns unambiguously.

```js
import { FieldCondition } from '@ucast/core';
import { allInterpreters, createSqlInterpreter, pg } from '@ucast/sql';

const interpret = createSqlInterpreter(allInterpreters);
const condition = new FieldCondition(
  'some',
  'projects',
  new FieldCondition('eq', 'active', true),
);

const [sql, params] = interpret(condition, {
  ...pg,
  alias: 'users',
  metadata: {
    resolveRelation(name) {
      if (name !== 'projects') {
        return undefined;
      }

      return {
        ownField: 'id',
        relatedField: 'user_id',
        relatedTable: 'projects',
      };
    },
  },
});

console.log(sql);
// EXISTS (SELECT 1 FROM "projects" as "projects_ucast0" WHERE "users"."id" = "projects_ucast0"."user_id" AND ("projects_ucast0"."active" = $1))
console.log(params); // [true]
```

Relation metadata contains:

* `ownField`: the join field on the current entity.
* `relatedField`: the join field on the related entity.
* `relatedTable`: the related table name.
* `metadata`: the related entity's column mapping and relation resolver. Use `{}`
  when neither is needed.

Nested relations use the related entity's `metadata.resolveRelation`. All scopes
share the root parameter sequence, and generated relation aliases use a counter
shared across the interpretation. An unresolved relation throws an error.

The default composer supports a single equality join per relation. For composite
keys, many-to-many joins, or other custom relation queries, provide a custom
composer with its own `relation` implementation.

### SQL composers

`createSqlInterpreter` creates a composer for each interpretation call. The default
string composer returns `[sql, params]`. To use another fragment representation or
result shape, pass `createSqlComposer` in the interpreter options:

```ts
const interpret = createSqlInterpreter<SQL>(allInterpreters, {
  createSqlComposer: options => new DrizzleComposer(options),
});
const result = interpret(condition, pg);
```

`SQL`, and `DrizzleComposer` above represent your own types and
implementation. The factory receives the SQL query options and returns a
`SqlComposer<Fragment>`, which provides:

| Helper | Purpose |
| --- | --- |
| `field(name)` | Map, escape, and qualify a field |
| `param(conditionOrValue)` | Bind a condition's value or a raw value |
| `manyParams(conditionOrValues)` | Bind an array of values |
| `sql` | Compose fragments with a tagged template |
| `raw(sql)` | Create a fragment from trusted SQL syntax |
| `join(fragments, separator)` | Join fragments using a fragment separator |
| `regexp(ignoreCase)` | Return the dialect's regex operator and comparator |
| `relation(name)` | Return a related `composer` and `subquery(predicate, invertCondition?)` |

`createDefaultSqlComposer(options)` is exported for extending
the built-in string composer.

### Custom interpreter

To restrict supported operators, pass only the desired functions:

```js
import { FieldCondition } from '@ucast/core';
import { createSqlInterpreter, eq, lt, gt, pg } from '@ucast/sql';

const interpret = createSqlInterpreter({ eq, lt, gt });
const condition = new FieldCondition('eq', 'x', true);

interpret(condition, pg);
```

To add a custom operator, create a function that receives a condition and a
composer and returns a SQL fragment. A third argument provides
`interpret(condition, composer)` for recursively interpreting child conditions.
Let's create an operator that adds a condition on `publishedAt`:

```ts
import { DocumentCondition } from '@ucast/core';
import {
  type SqlOperator,
  createSqlInterpreter,
  allInterpreters,
  pg,
} from '@ucast/sql';

const isActive: SqlOperator<DocumentCondition<boolean>> = (node, { sql, field, raw, param }) => {
  const operator = node.value ? ' >= ' : ' < ';
  return sql`${field('publishedAt')}${raw(operator)}${param(new Date())}`;
};
const interpret = createSqlInterpreter({
  ...allInterpreters,
  isActive,
});
const condition = new DocumentCondition('isActive', true);
const [sql, params] = interpret(condition, pg);

console.log(sql); // "publishedAt" >= $1
console.log(params); // [new Date()]
```

Use `param` for values and `field` for identifiers; reserve `raw` for trusted SQL
syntax. If condition names differ from registered operator names, pass
`getInterpreterName(condition, options)` in the `createSqlInterpreter` options.

## Integrations

This library provides sub-modules that allows quickly integrate SQL interpreter with popular ORMs:

### Drizzle ORM 0.45.x

Install `drizzle-orm` alongside `@ucast/sql`. The adapter targets 0.45.x and is
validated with 0.45.4. PostgreSQL, MySQL, and SQLite tables are supported; the
selected table determines the dialect.

```ts
import { createInterpreter } from '@ucast/sql/drizzle-orm';
import { FieldCondition } from '@ucast/core';
import { and, eq, relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const users = sqliteTable('users', {
  id: integer('id'),
  displayName: text('display_name'),
});
const userRelations = relations(users, () => ({}));
const interpret = createInterpreter({ schema: { users, userRelations } });
const predicate = interpret(new FieldCondition('eq', 'displayName', 'Alice'), 'users');
db.select().from(users).where(and(eq(users.id, 1), predicate));
```

Configure the schema once. It may contain both tables and native relation
declarations, but `interpret(condition, tableKey, options?)` accepts only table
keys. Unknown keys fail at runtime. The result is a synchronous, composable
Drizzle `SQL` predicate usable in SELECT, UPDATE, and DELETE queries.

For aliased queries, include an aliased table in the schema or pass
`{ rootAlias: 'u' }` as the third interpretation argument and use the same alias
in your query. Resolved fields retain native Drizzle columns, including column
names, schema qualification, casing, and comparison/membership encoders.
Unresolved properties become literal, escaped identifiers qualified with the
current table or alias; dots in a property do not introduce a path.

Scalar and Boolean operators reuse the standard SQL interpreters. Pass an
optional second factory argument to select or extend them:
`createInterpreter({ schema }, { eq, lt })`. Values are bound parameters; direct
Drizzle `SQL` objects as condition values are rejected because Drizzle would
otherwise treat them as executable syntax. Custom column encoders retain their
native behavior. Regular-expression patterns and modulo operands do not use
column encoders. SQLite regex execution requires an installed `regexp` database
function, as with the generic SQL interpreter.

Relation operators (`some`, `none`, and `every`) currently throw
`Error('Not Supported')`. Relation declarations may remain in the configured
schema for future relation support. Drizzle 1.x is outside this adapter's current
compatibility scope.

### [Sequelize](https://sequelize.org/)

```js
import { interpret } from '@ucast/sql/sequelize';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { Model, Sequelize, DataTypes } from 'sequelize';

const sequelize = new Sequelize('sqlite::memory:');

class User extends Model {}

User.init({
  name: { type: DataTypes.STRING },
  blocked: { type: DataTypes.BOOLEAN },
  lastLoggedIn: { type: DataTypes.DATETIME },
});

const condition = new CompoundCondition('and', [
  new FieldCondition('eq', 'blocked', false),
  new FieldCondition('lt', 'lastLoggedIn', Date.now() - 24 * 3600 * 1000),
]);

// {
//  where: literal('(`blocked` = 0 and lastLoggedIn < 1597594415354)')
// }
const query = interpret(condition, User)
```

### [Objection.js](https://vincit.github.io/objection.js/)

```js
import { interpret } from '@ucast/sql/objection';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { Model } from 'objection';
import Knex from 'knex';

Model.knex(Knex({ client: 'pg' }));

class User extends Model {}

const condition = new CompoundCondition('and', [
  new FieldCondition('eq', 'blocked', false),
  new FieldCondition('lt', 'lastLoggedIn', Date.now() - 24 * 3600 * 1000),
]);

// the next code produces:
// User.query()
//   .where('blocked', false)
//   .where('lastLoggedIn', Date.now() - 24 * 3600 * 1000)
const query = interpret(condition, User.query())
```

### [MikroORM](https://mikro-orm.io/)

```js
import { interpret } from '@ucast/sql/mikro-orm';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { MikroORM, Entity, PrimaryKey, Property } from 'mikro-orm';

@Entity()
class User {
  @PrimaryKey()
  id!: number;

  @Property()
  blocked: boolean;

  @Property()
  name!: string;

  @Property()
  lastLoggedIn = new Date();
}

const condition = new CompoundCondition('and', [
  new FieldCondition('eq', 'blocked', false),
  new FieldCondition('lt', 'lastLoggedIn', Date.now() - 24 * 3600 * 1000),
]);

async function main() {
  const orm = await MikroORM.init({
    entities: [User],
    dbName: ':memory:',
    type: 'sqlite',
  });

  // the next code produces:
  // orm.em.createQueryBuilder(User)
  //   .where('blocked = ?', [false])
  //   .andWhere('lastLoggedIn = ?', [Date.now() - 24 * 3600 * 1000])
  const qb = interpret(condition, orm.em.createQueryBuilder(User));
}

main().catch(console.error);
```

### [TypeORM](https://typeorm.io/)

```js
import { interpret } from '@ucast/sql/typeorm';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  createConnection
} from 'typeorm';

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  blocked: boolean;

  @Column()
  name!: string;

  @Column()
  lastLoggedIn = new Date();
}

const condition = new CompoundCondition('and', [
  new FieldCondition('eq', 'blocked', false),
  new FieldCondition('lt', 'lastLoggedIn', Date.now() - 24 * 3600 * 1000),
]);

async function main() {
  const conn = await createConnection({
    type: 'sqlite',
    database: ':memory:',
    entities: [User]
  });

  // the next code produces:
  // conn.createQueryBuilder(User, 'u')
  //   .where('blocked = ?', [false])
  //   .andWhere('lastLoggedIn = ?', [Date.now() - 24 * 3600 * 1000])
  const qb = interpret(condition, conn.createQueryBuilder(User, 'u'));
}

main().catch(console.error);
```

## TypeScript Support

Written in TypeScript and supports type inference for supported ORMs.

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/ucast/blob/main/CONTRIBUTING.md
