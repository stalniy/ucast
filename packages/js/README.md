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
const condition = new CompoundCondition('and', [
  new FieldCondition('gt', 'x', 5),
  new FieldCondition('lt', 'y', 10),
]);

interpret(condition, { x: 2, y: 1 }); // false
interpret(condition, { x: 6, y: 7 }); // true
```

The default `interpret` function:

* supports the next operators, implemented according to [MongoDB query language](https://docs.mongodb.com/manual/reference/operator/query/):

  * `eq`, `ne`
  * `lt`, `lte`
  * `gt`, `gte`
  * `within` (the same as `in` but `in` is a reserved word in JavaScript), `nin`
  * `all`
  * `regex`
  * `or`, `nor`, `and`, `not`
  * `exists`
  * `size`
  * `mod`
  * `where`,
  * `elemMatch`

* supports dot notation to access nested object property values in conditions:

  ```js
  const condition = new FieldCondition('eq', 'address.street', 'some street');
  interpret(condition, { address: { street: 'another street' } }); // false
  ```

* compare values by strict equality, so variables that reference objects are equal only if they are references to the same object:

  ```js
  const address = { street: 'test' };
  const condition = new FieldCondition('eq', 'address', address);

  interpret(condition, { address }) // true
  interpret(condition, { address: { street: 'test' } }) // false, objects are compared by strict equality
  ```


### Custom interpreter

Sometimes you may want to reduce (or restrict) amount of supported operators (e.g., to utilize tree-shaking and reduce bundle size). To do this you can create a custom interpreter manually:

```js
import { FieldCondition } from '@ucast/core';
import { createJsInterpreter, eq, lt, gt } from '@ucast/js';

// supports only $eq, $lt and $gt operators
const interpret = createJsInterpreter({ eq, lt, gt });
const condition = new FieldCondition('in', 'x', [1, 2]);

interpret(condition, { x: 1 }) // throws Error, `$in` is not supported
```

### Custom object matching

You can also provide a custom `get` or `compare` function. So, you can implement custom logic to get object's property or to compare values. `compare` is used everywhere equality or comparison is required (e.g., in `$in`, `$lt`, `$gt`). This function must return `1` if `a > b`, `-1` if `a < b` and `0` if `a === b`.

Let's enhance our interpreter to support deep object comparison using [lodash]:

```js
import isEqual from 'lodash/isEqual';
import { createJsInterpreter, allInterpreters, compare } from '@ucast/js';

const interpret = createJsInterpreter(allInterpreters, {
  compare(a, b) {
    if (typeof a === typeof b && typeof a === 'object' && isEqual(a, b)) {
      return 0;
    }

    return compare(a, b);
  }
});
const condition = new FieldCondition('eq', 'x', { active: true });

interpret(condition, { x: { active: true } }); // true
```

### Custom Operator Interpreter

Any operator is just a function that accepts 3 parameters and returns boolean result. To see how to implement this function let's create `$type` interpreter that checks object property type using `typeof` operator:

```js
import { createJsInterpreter } from '@ucast/js';

function type(condition, object, { get }) {
  return typeof get(object, condition.field) === condition.value;
}

const interpret = createJsInterpreter({ type });
const condition = new FieldCondition('type', 'x', 'number');

interpret(condition, { x: 1 }); // true
```

**Pay attention** that object property is got by using `get` function. Make sure that you always use `get` function in custom operators to get object's property value, otherwise your operator will not support dot notation.

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/ucast/blob/master/CONTRIBUTING.md
