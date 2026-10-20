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

Install `drizzle-orm` alongside `@ucast/sql`:

```sh
npm i @ucast/sql 'drizzle-orm@~0.45.4'
```

The adapter targets Drizzle ORM 0.45.x and is tested with 0.45.4. Its optional
peer dependency range is `~0.45.4`. PostgreSQL, MySQL, and SQLite are supported;
the selected table determines the dialect.

Create an interpreter once when your application starts, then pass a condition
and a table's schema key to interpret it:

```ts
import { createDrizzleInterpreter } from '@ucast/sql/drizzle-orm/v0.x';
import { FieldCondition } from '@ucast/core';
import { and, eq } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  displayName: text('display_name').notNull(),
});
const interpret = createDrizzleInterpreter({ schema: { users } });
const predicate = interpret(new FieldCondition('eq', 'displayName', 'Alice'), 'users');

// Use your configured Drizzle instance to construct and execute the query.
db.select().from(users).where(and(eq(users.id, 1), predicate));
```

`interpret(condition, tableKey, options?)` synchronously returns a Drizzle `SQL`
predicate. Use it in `SELECT`, `UPDATE`, or `DELETE` queries, or combine it with native Drizzle conditions using `and()` and `or()`. You own query construction and
execution; Drizzle renders the predicate and binds its parameters.

Table keys are inferred from the schema. Unknown table keys and unsupported table dialects throw when interpreting a condition.

#### Aliases and column names

Register original tables in the schema. Supply query aliases through the third
argument, using the same alias in your Drizzle query:

```ts
import { alias } from 'drizzle-orm/sqlite-core';

const u = alias(users, 'u');
const predicateForAlias = interpret(
  new FieldCondition('eq', 'displayName', 'Alice'),
  'users',
  { alias: 'u' },
);
db.select().from(u).where(predicateForAlias);
```

Conditions use table property names: `displayName` above resolves to
`display_name`. Native column references preserve Drizzle's naming, schema
qualification, casing, and input encoders, including custom encoders. Unknown
properties throw an error; dots in field names do not introduce a relation path.

#### Relations

Relation operators (`some`, `none`, and `every`) resolve native Drizzle relation
declarations and produce correlated `EXISTS`/`NOT EXISTS` subqueries. Include the
tables and their declarations in the factory's schema:

```ts
import { relations } from 'drizzle-orm';

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey(),
  authorId: integer('author_id').notNull(),
  title: text('title').notNull(),
});
const userRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));
const postRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
const schema = { users, posts, userRelations, postRelations };
const interpret = createDrizzleInterpreter({ schema });

const condition = new FieldCondition('some', 'posts',
  new FieldCondition('eq', 'title', 'Getting started'));
db.select().from(users).where(interpret(condition, 'users'));
```

Here, Drizzle infers the `users.posts` join from `posts.author`. Direct joins,
inferred inverse joins, composite keys, named self relations, and nested
relations are supported. Each nested condition uses the related table's columns
and encoders.

| Operator | Meaning |
| --- | --- |
| `some` | At least one related row matches the nested condition |
| `none` | No related row matches the nested condition |
| `every` | No related row satisfies the SQL negation of the nested condition |

`none` and `every` match parents without related rows. `every` preserves SQL's
usual NULL behavior.

Relations are normalized and validated once at interpreter creation. Register all tables referenced by your relation declarations, including declarations you do not use in a condition. Missing target tables, ambiguous or incomplete joins, and
cross-dialect relations fail at startup. Unknown relation names in conditions
fail during interpretation.

Express nested relations with nested condition nodes. For example, this follows
`users.posts.author`:

```ts
const hasPostByAlice = new FieldCondition('some', 'posts',
  new FieldCondition('some', 'author',
    new FieldCondition('eq', 'displayName', 'Alice')));
db.select().from(users).where(interpret(hasPostByAlice, 'users'));
```

Drizzle 0.x models many-to-many relations through a junction table. Register the
junction table and its relation declarations, then traverse both declared steps
with nested conditions in the same way. The interpreter does not invent a
direct many-to-many relation.

#### Operators and values

The factory uses all [supported operators](#supported-operators) by default.
Pass an optional second argument to select or extend the interpreter set. These
operators come from `@ucast/sql`:

```ts
import { eq as interpretEq, lt as interpretLt } from '@ucast/sql';

const interpretSelected = createDrizzleInterpreter(
  { schema: { users } },
  { eq: interpretEq, lt: interpretLt },
);
```

Values are bound parameters. Comparisons and membership conditions use the
resolved column's encoder; regular-expression patterns and modulo operands do
not. Direct Drizzle `SQL` objects as condition values are rejected because
Drizzle would otherwise render them as executable syntax. Use native Drizzle
predicates or custom interpreters to compose SQL expressions.

Drizzle 1.x is outside this adapter's compatibility scope.

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
