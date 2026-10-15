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

`interpret` is a function that takes up to 3 parameters:

1. `Condition`, condition to interpret
2. `options`, SQL dialect specific options that tells how to escape field names and create placeholders. `@ucast/sql` provides options for the most popular SQL dialects.
3. `relationContext`, optional, this value is passed to `getRelationMetadata` and `localField` and is useful when integrating with ORMs and their metadata.

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

### Map model properties to database columns

Use `localField` to resolve a model property and escape the resulting column.
It receives the field after existing prefix handling and a helper with the
current `relationContext` and dialect `escape` function. Return the escaped
column fragment; the interpreter applies the current query alias.

```ts
const columns: Record<string, string> = { displayName: 'display_name' };
const condition = new FieldCondition('eq', 'displayName', 'Alice');

const [sql, params] = interpret(condition, {
  ...pg,
  rootAlias: 'users',
  localField(property, { relationContext, escape }) {
    const column = (relationContext as Record<string, string>)[property];
    return escape(column ?? property);
  },
}, columns);

// sql: '"users"."display_name" = $1'
// params: ['Alice']
```

Use your data layer's mapping primitive or metadata in this callback. Boolean
conditions keep the current context. Conditions inside a relation use the
`relationContext` returned by that relation's metadata.

The TypeORM, Sequelize, Objection, and MikroORM adapters resolve condition
properties from their model metadata automatically, including configured column
names. A property resolving to more than one physical column throws an explicit
unsupported-mapping error. A field that the model does not resolve remains a
literal SQL identifier. For unusual property/column name collisions, the property
mapping takes precedence.

The `parentField` and `relationField` helpers in custom relation builders use
`localField` with the parent and related model contexts, respectively. They
resolve and escape fields consistently with condition predicates, then apply
the appropriate query alias:

```ts
buildRelationQuery(relation) {
  return relation.sql`SELECT 1 FROM ${relation.escapeIdentifier('tenant_projects')} as ${relation.escapeIdentifier(relation.relationAlias)} WHERE ${relation.parentField('tenantId')} = ${relation.relationField('ownerId')} AND (${relation.conditionSql()})`;
}
```

The ORM adapters use join fields supplied by their data layer. An unresolved
field remains a literal column name through the adapter's normal fallback.
Table names, relation names, and aliases remain outside property mapping.

### Conditions on related tables

Use `some`, `none`, and `every` to express conditions against related records:

* `some` checks that at least one related record matches the condition
* `none` checks that no related records match the condition
* `every` checks that no related record violates the condition

Relation operators need metadata that describes how the current table is connected to the related table. ORM integrations provide this automatically, so in most cases you can use relation conditions directly:

```js
import { FieldCondition } from '@ucast/core';

const condition = new FieldCondition(
  'some',
  'projects',
  new FieldCondition('eq', 'active', true),
);
```

When using `createSqlInterpreter` directly, or when your domain model is not mapped 1-to-1 to database tables, provide `getRelationMetadata`:

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
  rootAlias: 'users',
  getRelationMetadata(relationName) {
    if (relationName !== 'projects') {
      return undefined;
    }

    return {
      parentField: 'id',
      relationField: 'user_id',
      relationTable: 'projects',
    };
  },
});

console.log(sql);
// EXISTS (SELECT 1 FROM "projects" as "projects_0" WHERE "users"."id" = "projects_0"."user_id" AND ("projects_0"."active" = $1))
console.log(params); // [true]
```

For composite keys, many-to-many relations, or permission-specific joins, return custom metadata with `buildRelationQuery`. Use `relationContext` when nested relation conditions need to resolve metadata from the related entity.

### SQL fragment backends

`createSqlInterpreter` creates one backend for each interpretation call. Without a
`backend` option, it creates the built-in string backend and returns `[sql, parameters]`.
The backend owns its parameter array and placeholder sequence, so repeated calls
start with a fresh `$1`. Root and child queries use the same backend instance.

For native fragments, provide a backend factory in the `createSqlInterpreter` options. It returns a
`SqlBackend<Fragment, Result>` with `sql`, `raw`, `param`, `manyParams`, `join`, and
`result` helpers. `sql` is a tagged function that the backend binds to its own state;
`raw` marks trusted SQL syntax or escaped identifiers, while `param` binds values.
Custom operators and relation builders receive those same helpers on their context.
The interpreter calls `result` once after the root query is complete; nested queries
pass fragments directly to their parents.

```ts
const interpret = createSqlInterpreter<MyFragment, MyFragment>(allInterpreters, {
  backend: () => new MyBackend(),
})
const predicate = interpret(condition, pg)
```

Direct `Query` construction requires an explicit backend instance, for example
`new Query(pg, createDefaultSqlBackend(pg))`. A native backend needs `regexp` to
interpret regex conditions. Dialect `escapeIdentifier(name)` quotes identifiers;
relation builders use `context.escapeIdentifier(name)` for an identifier fragment.
String relation builders remain valid with the default backend.

### Custom interpreter

Sometimes you may want to add custom operator or restrict supported operators. To do this, just pass desired operators manually:

```js
import { createSqlInterpreter, eq, lt, gt, pg } from '@ucast/sql';

const interpret = createSqlInterpreter({ eq, lt, gt });
const condition = new FieldCondition('eq', 'x', true);

interpret(condition, pg);
```

To add a custom operator, all you need to do is to create a function that applies `Condition` to instance of `Query` object. Let's create an operator, that adds condition on `publishedAt` field:

```ts
import { DocumentCondition } from '@ucast/core';
import {
  SqlOperator,
  createSqlInterpreter,
  allInterpreters,
  pg,
} from '@ucast/sql';

const isActive: SqlOperator<DocumentCondition<boolean>> = (node, query, context) => {
  const operator = node.value ? ' >= ' : ' < ';
  return query.where(context.sql`${query.field('publishedAt')}${context.raw(operator)}${context.param(new Date())}`);
};
const interpret = createSqlInterpreter({
  ...allInterpreters,
  isActive,
});
const condition = new DocumentCondition('isActive', true);
const [sql, params] = interpret(condition, pg);

console.log(sql) // "publishedAt" >= $1
console.log(params) // [new Date()]
```

## Integrations

This library provides sub-modules that allows quickly integrate SQL interpreter with popular ORMs:

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
