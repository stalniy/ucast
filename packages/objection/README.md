# UCAST Objection

[![@ucast/objection NPM version](https://badge.fury.io/js/%40ucast%2Fobjection.svg)](https://badge.fury.io/js/%40ucast%2Fobjection)
[![](https://img.shields.io/npm/dm/%40ucast%2Fobjection.svg)](https://www.npmjs.com/package/%40ucast%2Fobjection)

This package is a part of [ucast] ecosystem. It provides a parser that can parse [Objection query](https://docs.mongodb.com/manual/reference/operator/query/) into conditions AST.

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

To parse MongoDB query into conditions AST, you need to create a `MongoQueryParser` instance:

```js
import { MongoQueryParser, allParsingInstructions } from '@ucast/objection';

const parser = new MongoQueryParser(allParsingInstructions);
const ast = parser.parse({
  id: 1,
  active: true
});
```

To create a parser you need to pass in it parsing instruction. Parsing instruction is an object that defines how a particular operator should be parsed. There are 3 types of `ParsingInstruction`, one for each `Condition`:

* `FieldInstruction`\
  It represents an instruction for an operator which operates in a field context only. For example, operators `$eq`, `$lt`, `$not`, `$regex`
* `CompoundInstruction`\
  It represents an instruction for an operator which operates in a document context and contains nested queries. For example, operators `$and`, `$or`, `$nor`
* `ValueInstruction`\
  It represents an instruction for an operator which operates in a document context only. For example, `$where`

### Optimization logic

It's important to understand that it's not required for `FieldInstruction` to be parsed into `FieldCondition`. I can be parsed into `CompoundCondition` as it's done for `$not` operator.

Also some operators like `$and` and `$or` optimize their parsing logic, so if one of that operators contain only one condition it will be resolved to `FieldCondition`.

As said before `$and` and `$or` operators optimize their representation in case they have a single condition but this is not all. They also recursively collapse conditions from nested operators with the same name. Let's see an example to understand what this means:

```js
const ast = parser.parse({
  a: 1
  $and: [
    { b: 2 },
    { c: 3 }
  ]
});
console.dir(ast, { depth: null })
/*
 CompoundCondition {
   operator: "$and",
   value: [
     FieldCondition { operator: "$eq", field: "a", value: 1 },
     FieldCondition { operator: "$eq", field: "b", value: 2 },
     FieldCondition { operator: "$eq", field: "c", value: 3 },
   ]
 }
 */
```

This optimization logic helps to speed up interpreter's execution time, instead of going deeply over tree-like structure we have a plain structure of all conditions under a single compound condition.

### Custom Operator

In order for an operator to be parsed, it needs to define a parsing instruction. Let's implement a custom instruction which checks that object corresponds to a particular [json schema](https://json-schema.org/).

First of all, we need to understand on which level this operator operates (field or document). In this case, `$jsonSchema` clearly operates on document level. It doesn't contain nested MongoDB queries, so it should be defined using `DocumentInstruction`.

To test that document corresponds to provided json schema, we will use [ajv](https://ajv.js.org/) but it's possible to use any JSON schema validator you want.

```js
// operators/jsonSchema.js
import { DocumentInstruction, DocumentCondition } from '@ucast/core';
import Ajv from 'ajv';

export const $jsonSchema: DocumentInstruction = {
  type: 'document',
  validate(instruction, value) {
    if (!value || typeof value !== 'object') {
      throw new Error(`"${instruction.name}" expects to receive an object`)
    }
  },
  parse(instruction, schema) {
    const ajv = new Ajv();
    return new DocumentCondition(instruction.name, ajv.compile(schema));
  }
};
```

In order to use this operator, we need to pass it into `MongoQueryParser` constructor:

```js
import { MongoQueryParser, allParsingInstructions } from '@ucast/core';
import { $jsonSchema } from './operators/jsonSchema';

const parser = new MongoQueryParser({ ...allParsingInstructions, $jsonSchema });
const ast = parser.parse({
  $jsonSchema: {
    type: 'object',
    properties: {
      firstName: { type: 'string' },
      lastName: { type: 'string' },
    },
    additionalProperties: false,
  }
});

console.dir(ast, { depth: null });
/*
  DocumentCondition { operator: "$jsonSchema", value: [Function: validate] }
 */
```

The only thing which is left is to implement a corresponding interpreter.

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/uscast/blob/master/CONTRIBUTING.md
