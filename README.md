# UCAST - Universal Conditions AST

![build](https://github.com/stalniy/ucast/workflows/CI/badge.svg)
[![CASL codecov](https://codecov.io/gh/stalniy/ucast/branch/master/graph/badge.svg)](https://codecov.io/gh/stalniy/ucast)
[![UCAST join the chat](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/stalniy-ucast/community)

`ucast` is a low level library that helps to create awesome things! It aims to be a universal way to represent a set of conditions that can be transferred between APIs and databases.

## Terms

To get introduction about what is parser, interpreter, conditions AST and translator, please check the [README file of @ucast/core](./packages/core/README.md)

## What can I do with it?

1. You can translate an HTTP request query string into SQL, Mongo, ElasticSearch or anything you can imagine.
2. You can execute MongoDB query in javascript runtime
3. You can create an expressive query builder for SQL

Generally speaking, `ucast` can help you to transfer conditions somewhere or interpret them in any way.

## Ecosystem

All packages support nodejs 8+ and ES5 compatible browsers (IE 9+)

| Project           | Status                               | Description |
|-------------------|--------------------------------------|-------------|
| [@ucast/core]     | [![@ucast/core-status]][@ucast/core-package] | conditions AST and helpers |
| [@ucast/js]       | [![@ucast/js-status]][@ucast/js-package] | ucast JavaScript interpreter |
| [@ucast/mongo]    | [![@ucast/mongo-status]][@ucast/mongo-package] | [MongoDB query] parser |
| [@ucast/mongo2js]    | [![@ucast/mongo2js-status]][@ucast/mongo2js-package] | Evaluates [MongoDB query] in JavaScript runtime |
| [@ucast/objection]    | [![@ucast/objection-status]][@ucast/objection-package] | [Objection query] interpreter (SQL ORM) |


[MongoDB query]: http://docs.mongodb.org/manual/reference/operator/query/
[Objection query]: https://vincit.github.io/objection.js/api/query-builder/

[@ucast/core]: packages/core
[@ucast/js]: packages/js
[@ucast/mongo]: packages/mongo
[@ucast/mongo2js]: packages/mongo2js
[@ucast/objection]: packages/objection

[@ucast/core-status]: https://img.shields.io/npm/v/@ucast/core.svg
[@ucast/js-status]: https://img.shields.io/npm/v/@ucast/js.svg
[@ucast/mongo-status]: https://img.shields.io/npm/v/@ucast/mongo.svg
[@ucast/mongo2js-status]: https://img.shields.io/npm/v/@ucast/mongo2js.svg
[@ucast/objection-status]: https://img.shields.io/npm/v/@ucast/objection.svg

[@ucast/core-package]: https://www.npmjs.com/package/@ucast/core
[@ucast/js-package]: https://www.npmjs.com/package/@ucast/js
[@ucast/mongo-package]: https://www.npmjs.com/package/@ucast/mongo
[@ucast/mongo2js-package]: https://www.npmjs.com/package/@ucast/mongo
[@ucast/objection-package]: https://www.npmjs.com/package/@ucast/objection

## Want to help?

Want to file a bug, contribute some code, or improve documentation? Excellent! Read up on guidelines for [contributing]

## License

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)

[contributing]: https://github.com/stalniy/uscast/blob/master/CONTRIBUTING.md
