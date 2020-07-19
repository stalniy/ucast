# UCAST Objection

[![@ucast/objection NPM version](https://badge.fury.io/js/%40ucast%2Fobjection.svg)](https://badge.fury.io/js/%40ucast%2Fobjection)
[![](https://img.shields.io/npm/dm/%40ucast%2Fobjection.svg)](https://www.npmjs.com/package/%40ucast%2Fobjection)

This package is a part of [ucast] ecosystem. It provides a parser that can parse [Objection query](https://vincit.github.io/objection.js/api/query-builder/) into conditions AST.

[ucast]: https://github.com/stalniy/ucast

## Installation

```sh
npm i @ucast/objection
# or
yarn add @ucast/objection
# or
pnpm add @ucast/objection
```

## Getting Started

### Interpret conditions AST

First of all, you need AST to interpret it. For the sake of an example, we will create it manually:

```js
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { interpret } from '@ucast/objection';
import { Model } from 'objection';

class User extends Model {
  static tableName = 'users'
}

// x > 5 && y < 10
const condition = new CompoundCondition('$and', [
  new FieldCondition('$gt', 'x', 5),
  new FieldCondition('$lt', 'y', 10),
]);

interpret(condition, User.query()); // select users.* from users where x > 5 and y < 10
```

**Pay attention**, all operators has `$` prefix. This was done to make sure that names of operators doesn't intersects with JavaScript reversed words (e.g., `in`). This also helps to support tree shaking (so, it's possible to `export const $in = ...`);

* supports dot notation to access related table values in conditions:

  ```js
  const condition = new FieldCondition('$eq', 'address.street', 'some street');
  interpret(condition, User.query()); // select users.* from users inner join address on user.id = address.user_id where address.street = 'some street'
  ```

### Custom interpreter

Sometimes you may want to reduce (or restrict) amount of supported operators (e.g., to utilize tree-shaking and reduce bundle size). To do this you can create interpreter manually:

```js
import { createObjectionInterpreter, $eq, $lt, $gt } from '@ucast/objection';

const interpret = new createObjectionInterpreter(({ $eq, $lt, $gt });
const condition = new FieldCondition('$eq', 'x', true);

interpret(condition, User.query()); // select * from users where x = true
```

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/uscast/blob/master/CONTRIBUTING.md
