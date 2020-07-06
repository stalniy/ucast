# Universal Conditions AST

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

Parser is a function that translates conditions from any language into conditions AST. For example, `MongoQueryParser` parses MongoQuery into conditions AST which then can be interpreted by `JavaScriptInterpreter` to get a boolean value against object of values.

### Conditions AST

Abstract Syntax Tree of any condition. What is condition? `x > 4` is a condition, `x === 4` is a condition as well, `{ x: { $eq: 4 } }` is a [MongoQuery](http://docs.mongodb.org/manual/reference/operator/query/) condition.

There are 2 types of conditions:

* **ValueCondition**. Any condition that does not depend on field (e.g., in Mongo Query it's `$where` operator and in SQL it's `EXISTS`)
* **FieldCondition**. Depends on a field and its value. For example, in condition `x > 4`, `x` is a field, `4` is a value and `>` is operator
* **CompoundCondition**. Combines other conditions using logical operations like "and", "or", "not".

### Interpreter

Interpreter is a function that interprets conditions AST in a specific way. For example, it can interpret conditions in JavaScript runtime and return a boolean result, or it can convert conditions into SQL `WHERE` statement, or MongoDB query, or HTTP query string. At this point, I think you got that we can interpret AST in any way we need or want!


### Translator

Combines Parser and Interpreter and returns a factory function. In other words:

```js
const parse = (query) => /* conditions AST */
const interpreter = createInterpreter({ /* condition interpreters */ });
const translate = (query, ...args) => interpreter.bind(null, parse(query));
```

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/uscast/blob/master/CONTRIBUTING.md
