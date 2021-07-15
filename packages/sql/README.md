# UCAST SQL

[![@ucast/sql NPM version](https://badge.fury.io/js/%40ucast%2Fsql.svg)](https://badge.fury.io/js/%40ucast%2Fsql)
[![](https://img.shields.io/npm/dm/%40ucast%2Fsql.svg)](https://www.npmjs.com/package/%40ucast%2Fsql)

This package is a part of [ucast] ecosystem. It provides an interpreter that can translates ucast conditions into [SQL query](https://en.wikipedia.org/wiki/SQL).

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
2. `options`, SQL dialect specific options that tells how to escape field, create placeholders and join related tables. `@ucast/sql` provides options for the most popular SQL dialects.
3. `targetQuery`, optional, this is the parameter that `@ucast/sql` passes as the 2nd one to `joinRelation` function. This is useful when integrating with ORMs and their query builders.

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
  ...pg,
  joinRelation: () => false
})

console.log(sql) // ("x" > $1 and "y < $2)
console.log(params) // [5, 10]
```

### Conditions on related table

Interpreter automatically detects fields with dot (`.`) inside and interprets them as fields of a relation. It's possible to automatically inner join table using `options.joinRelation` function. That function accepts 2 parameters: relation name and targetQuery (3rd argument of `interpret` function). For example:

```js
const condition = new FieldCondition('eq', 'address.street', 'some street');
const relations = { address: '"address"."id" = "address_id"' };
const [sql, params, joins] = interpret(condition, {
  ...pg,
  joinRelation: relationName => relations.hasOwnProperty(relationName)
});

console.log(sql); // "address"."street" = $1
console.log(params); // ['some street']
console.log(joins); // ['address']
```

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

const isActive: SqlOperator<DocumentCondition<boolean>> = (node, query) => {
  const operator = node.value ? '>=' : '<';
  return query.where('publishedAt', operator, new Date());
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
//  include: [],
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

[contributing]: https://github.com/stalniy/ucast/blob/master/CONTRIBUTING.md
