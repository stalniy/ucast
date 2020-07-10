# UCAST JavaScript

[![@ucast/js NPM version](https://badge.fury.io/js/%40ucast%2Fjs.svg)](https://badge.fury.io/js/%40ucast%2Fjs)
[![](https://img.shields.io/npm/dm/%40ucast%2Fjs.svg)](https://www.npmjs.com/package/%40ucast%2Fjs)
[![UCAST join the chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/stalniy-ucast/community)

This package is a part of [ucast] ecosystem. It provides interpreter that can execute conditions AST in JavaScript against any JavaScript object.

[ucast]: https://github.com/stalniy/ucast

## Installation

```sh
npm i @ucast/js
# or
yarn add @ucast/js
# or
pnpm add @ucast/js
```

## Getting Started

### Interpret conditions AST

First of all, you need AST to interpret it. For the sake of an example, we will create it manually:

```js
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { interpret } from '@ucast/js';

// x > 5 && y < 10
const condition = new CompoundCondition('$and', [
  new FieldCondition('$gt', 'x', 5),
  new FieldCondition('$lt', 'y', 10),
]);

interpret(condition, { x: 2, y: 1 }); // false
interpret(condition, { x: 6, y: 7 }); // true
```

**Pay attention**, all operators has `$` prefix. This was done to make sure that names of operators doesn't intersects with JavaScript reversed words (e.g., `in`). This also helps to support tree shaking (so, it's possible to `export const $in = ...`);

The default `interpret` function:

* supports the next operators, implemented according to [MongoDB query language](https://docs.mongodb.com/manual/reference/operator/query/):

  * `$eq`, `$ne`
  * `$lt`, `$lte`
  * `$gt`, `$gte`
  * `$in`, `$nin`
  * `$all`
  * `$regex`
  * `$or`, `$nor`, `$and`, `$not`
  * `$exists`
  * `$size`
  * `$mod`
  * `$where`,
  * `$elemMatch`

* supports dot notation to access nested object property values in conditions:

  ```js
  const condition = new FieldCondition('$eq', 'address.street', 'some street');
  interpret(condition, { address: { street: 'another street' } }); // false
  ```

* compare values by strict equality, so variables that reference objects are equal only if they are references to the same object


### Custom interpreter

Sometimes you may want to reduce (or restrict) amount of supported operators (e.g., to utilize tree-shaking and reduce bundle size). To do this you can create interpreter manually:

```js
import { FieldCondition } from '@ucast/core';
import { createJsInterpreter, $eq, $lt, $gt } from '@ucast/js';

// supports only $eq, $lt and $gt operators
const interpret = createJsInterpreter({ $eq, $lt, $gt });
const condition = new FieldCondition('$in', 'x', [1, 2]);

interpret(condition, { x: 1 }) // throws Error, `$in` is not supported
```

Alternatively if you don't like to prefix your operators with `$`, you can rename them during interpreter creation phase:

```js
import { createJsInterpreter, $eq, $lt, $gt } from '@ucast/js';

// supports now eq, lt and gt
const interpret = createJsInterpreter({ eq: $eq, lt: $lt, gt: $gt });
```

You can also provide a custom `get` or `equal` function. So, you can implement custom to logic get object's property or to compare values. `equal` is used everywhere equality is required (e.g., in `$in`).
Let's enhance our interpreter to support deep object comparison using [lodash]:

```js
import equal from 'lodash/isEqual';
import { createJsInterpreter, allInterpreters } from '@ucast/js';

const interpret = createJsInterpreter(allInterpreters, { equal });
const condition = new FieldCondition('$eq', 'x', { active: true });

interpret(condition, { x: { active: true } }); // true
```

### Custom Operator Interpreter

Any operator is just a function that accepts 3 parameters and returns boolean result. To see how to implement this function let's create `$type` interpreter that checks object property type using `typeof` operator:

```js
import { createJsInterpreter } from '@ucast/js';

function $type(condition, object, { get }) {
  return typeof get(object, condition.field) === condition.value;
}

const interpret = createJsInterpreter({ $type });
const condition = new FieldCondition('$type', 'x', 'number');

interpret(condition, { x: 1 }); // true
```

**Pay attention** that object property is got by using `get` function. Make sure that you always use `get` function in custom operators to get object's property value, otherwise your operator will not support dot notation.

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/uscast/blob/master/CONTRIBUTING.md
