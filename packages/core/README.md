# Universal Conditions AST

[![@ucast/core NPM version](https://badge.fury.io/js/%40ucast%2Fcore.svg)](https://badge.fury.io/js/%40ucast%2Fcore)
[![](https://img.shields.io/npm/dm/%40ucast%2Fcore.svg)](https://www.npmjs.com/package/%40ucast%2Fcore)
[![UCAST join the chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/stalniy-ucast/community)

This package contains classes and functions that helps to create parsers, conditions AST, interpreters and translators.

## Installation

```sh
npm i @ucast/core
# or
yarn add @ucast/core
# or
pnpm add @ucast/core
```

## Getting Started

### Parser

Parser is a function that translates conditions from any language into conditions AST. For example, `MongoQueryParser` parses MongoQuery into AST which then can be interpreted by `JavaScriptInterpreter` that returns a boolean value based on passed in object.

### Conditions AST

Abstract Syntax Tree of any condition. **What is condition?**
`x > 4` is a condition, `x === 4` is a condition as well, `{ x: { $eq: 4 } }` is a [MongoQuery](http://docs.mongodb.org/manual/reference/operator/query/) condition.

There are few types of AST nodes that allow us to represent any condition:

* **FieldCondition**. \
  Depends on a field, operator and its value. For example, in condition `x > 4`, `x` is a field, `4` is a value and `>` is operator
* **DocumentCondition**. \
  Any condition that test a document (or a row) as whole (e.g., in MongoDB Query, it's `$where` operator and in SQL it's `EXISTS`).
* **CompoundCondition**. \
  Combines other conditions using logical operations like "and", "or", "not".

### Interpreter

An interpreter is a function that interprets conditions AST in a specific way. For example, it can:

* interpret conditions in JavaScript runtime to return a boolean result
* or it can convert conditions into SQL `WHERE` statement
* or MongoDB query,
* or HTTP/REST query
* or GraphQL input
* or anything else you can imagine

### Translator

Combines Parser and Interpreter and returns a factory function:

```js
const parse = (query) => /* to conditions AST */
const interpreter = createInterpreter({ /* condition interpreters */ });
const translate = (query, ...args) => interpreter.bind(null, parse(query));
```

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/ucast/blob/master/CONTRIBUTING.md
