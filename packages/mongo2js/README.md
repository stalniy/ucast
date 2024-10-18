# UCAST Mongo Query to JavaScript Translator

[![@ucast/mongo NPM version](https://badge.fury.io/js/%40ucast%2Fmongo2js.svg)](https://badge.fury.io/js/%40ucast%2Fmongo2js)
[![](https://img.shields.io/npm/dm/%40ucast%2Fmongo2js.svg)](https://www.npmjs.com/package/%40ucast%2Fmongo2js)
[![UCAST join the chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/stalniy-ucast/community)

This package is a part of [ucast] ecosystem. It combines [@ucast/mongo] and [@ucast/js] into a package that allows to evaluate [MongoDB query](https://docs.mongodb.com/manual/reference/operator/query/) conditions in JavaScript runtime.

[ucast]: https://github.com/stalniy/ucast
[@ucast/mongo]: https://github.com/stalniy/ucast/tree/master/packages/mongo
[@ucast/js]: https://github.com/stalniy/ucast/tree/master/packages/js

## Installation

```sh
npm i @ucast/mongo2js
# or
yarn add @ucast/mongo2js
# or
pnpm add @ucast/mongo2js
```

## Getting Started

To check that POJO can be matched by Mongo Query:

```js
import { guard } from '@ucast/mongo2js';

const test = guard({
  lastName: 'Doe',
  age: { $gt: 18 }
});

console.log(test({
  firstName: 'John',
  lastName: 'Doe',
  age: 19
})); // true
```

You can also get access to parsed Mongo Query AST:

```js
console.log(test.ast); /*
{
  operator: 'and',
  value: [
    { operator: 'eq', field: 'lastName', value: 'Doe' },
    { operator: 'gt', field: 'age', value: 18 }
  ]
}
*/
```

### Testing primitives

For cases, when you need to test primitive elements, you can use `squire` function:

```js
import { squire } from '@ucast/mongo2js';

const test = squire({
  $lt: 10,
  $gt: 18
});

test(11) // true
test(9) // false
```

### Custom Operator

In order to implement a custom operator, you need to create a [custom parsing instruction for `MongoQueryParser`](https://github.com/stalniy/ucast/tree/master/packages/mongo#custom-operator) and [custom `JsInterpreter`](https://github.com/stalniy/ucast/tree/master/packages/js#custom-operator-interpreter) to interpret this operator in JavaScript runtime.

This package re-exports all symbols from `@ucast/mongo` and `@ucast/js`, so you don't need to install them separately. For example, to add support for [json-schema](https://json-schema.org/) operator:

```ts
import {
  createFactory,
  DocumentCondition,
  ParsingInstruction,
  JsInterpreter,
} from '@ucast/mongo2js';
import Ajv from 'ajv';

type JSONSchema = object;
const ajv = new Ajv();
const $jsonSchema: ParsingInstruction<JSONSchema> = {
  type: 'document',
  validate(instruction, value) {
    if (!value || typeof value !== 'object') {
      throw new Error(`"${instruction.name}" expects to receive an object`)
    }
  },
  parse(instruction, schema) {
    return new DocumentCondition(instruction.name, ajv.compile(schema));
  }
};
const jsonSchema: JsInterpreter<DocumentCondition<Ajv.ValidateFunction>> = (
  condition,
  object
) => condition.value(object) as boolean;

const customGuard = createFactory({
  $jsonSchema,
}, {
  jsonSchema
});
const test = customGuard({
  $jsonSchema: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
    required: ['firstName', 'lastName'],
  }
});

console.log(test({ firstName: 'John' })); // false, `lastName` is not defined
```

To create a custom operator which tests primitives (as `squire` does), use the
`forPrimitives` option:

```ts
const customSquire = createFactory({
  $custom: {
    type: 'field',
  }
}, {
  custom: (condition, value) => value === (condition.value ? 'on' : 'off')
}, {
  forPrimitives: true
});
const test = customGuard({ $custom: true });
console.log(test('on')) // true
```

## TypeScript support

This package is written in TypeScript and supports type inference for MongoQuery:

```ts
import { guard } from '@ucast/mongo2js';

interface Person {
  firstName: string
  lastName: string
  age: number
}

const test = guard<Person>({ lastName: 'Doe' });
```

You can also use dot notation to set conditions on deeply nested fields:

```ts
import { guard } from '@ucast/mongo2js';

interface Person {
  firstName: string
  lastName: string
  age: number
  address: {
    city: string
    country: string
  }
}

type ExtendedPerson = Person & {
  'address.city': Person['address']['city']
}

const test = guard<ExtendedPerson>({ lastName: 'Doe' });
```

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/ucast/blob/master/CONTRIBUTING.md
