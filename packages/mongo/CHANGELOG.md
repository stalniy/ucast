# Change Log

All notable changes to this project will be documented in this file.

# [2.2.0](https://github.com/stalniy/ucast/compare/@ucast/mongo@2.1.2...@ucast/mongo@2.2.0) (2020-08-18)


### Features

* **parser:** adds possibility to set `parse` function ([8a1e388](https://github.com/stalniy/ucast/commit/8a1e388fe1c5722ae322b783101f066d763dfde5)), closes [#9](https://github.com/stalniy/ucast/issues/9)

## [2.1.2](https://github.com/stalniy/ucast/compare/@ucast/mongo@2.1.1...@ucast/mongo@2.1.2) (2020-08-13)


### Bug Fixes

* **parser:** updates @ucast/core and uses `buildAnd` instead of `and` ([154c7a6](https://github.com/stalniy/ucast/commit/154c7a6ff86c3a193592f642416030d0d78ea8ea))

## [2.1.1](https://github.com/stalniy/ucast/compare/@ucast/mongo@2.1.0...@ucast/mongo@2.1.1) (2020-08-13)


### Performance Improvements

* **parser:** replaces `Object.keys().forEach` with `Object.keys() + for(..)` ([003661d](https://github.com/stalniy/ucast/commit/003661da2170243a6bd95233df397eb7c9c4d70a))

# [2.1.0](https://github.com/stalniy/ucast/compare/@ucast/mongo@2.0.0...@ucast/mongo@2.1.0) (2020-08-10)


### Bug Fixes

* **types:** ensure `MongoQuery<any>` returns proper types and can be used with primitive values ([d138ee5](https://github.com/stalniy/ucast/commit/d138ee565bc54d623a283243dc12fc9c930dd2af))


### Features

* **types:** exports CustomOperators type and adds `BuildMongoQuery` type ([5ebff17](https://github.com/stalniy/ucast/commit/5ebff1709a448d8683650b26ffff5b7e472c6ac3))

# [2.0.0](https://github.com/stalniy/ucast/compare/@ucast/mongo@1.1.0...@ucast/mongo@2.0.0) (2020-08-08)


### Bug Fixes

* **docs:** removes `$` sign from README examples ([0dc924a](https://github.com/stalniy/ucast/commit/0dc924af72abfefa41ebeac107f1bc070ad796c7))


### Code Refactoring

* **parser:** removes `$` from operator name in resulting AST ([e589a9c](https://github.com/stalniy/ucast/commit/e589a9ce577bc191f48e481fc8aebe5b1164783b))


### BREAKING CHANGES

* **parser:** `MongoQueryParser.parse` returns AST with operator names that doesn't have `$` prefix. This was done to make it easier import/re-export parser instructions and operator interpreters from single package

# [1.1.0](https://github.com/stalniy/ucast/compare/@ucast/mongo@1.0.2...@ucast/mongo@1.1.0) (2020-08-08)


### Features

* **mongo:** adds built-in `$all` instruction for MongoQueryParser ([6d3f224](https://github.com/stalniy/ucast/commit/6d3f224bcba1ef6b875f992752f08d01116bbf9b))


### Performance Improvements

* **build:** adds es6cjs format which works few times faster then umd in node env ([4adba3b](https://github.com/stalniy/ucast/commit/4adba3bbf85afe95abfbcee0e36b5edc9d09396f))

## [1.0.2](https://github.com/stalniy/ucast/compare/@ucast/mongo@1.0.1...@ucast/mongo@1.0.2) (2020-07-23)


### Bug Fixes

* **license:** changes mistakenly set MIT license to the correct one - Apache 2.0 ([197363c](https://github.com/stalniy/ucast/commit/197363c321392c742d31b7e1e024d88c0499ce73))

## [1.0.1](https://github.com/stalniy/ucast/compare/@ucast/mongo@1.0.0...@ucast/mongo@1.0.1) (2020-07-10)


### Bug Fixes

* **package:** fixes deps ranges ([c2de9c1](https://github.com/stalniy/ucast/commit/c2de9c1b2d6ad85050f4eeb2635c6cb377200013)), closes [#1](https://github.com/stalniy/ucast/issues/1)

# 1.0.0 (2020-07-10)


### Features

* **mongo:** adds basic implementation for mongo parser and js interpreter ([a8f7271](https://github.com/stalniy/ucast/commit/a8f7271fc893491755e5c7fb522ed42be992e7b1))
* **mongo:** stabilize mongo package ([7d77768](https://github.com/stalniy/ucast/commit/7d7776874be3050026b53ee3b61c3361a89d1b21))
* **mongo:** updates mongo parser to support ValueParsingInstruction ([b918c34](https://github.com/stalniy/ucast/commit/b918c34224a5b60f3f1aa16197587f279b0e3e3a))


### Reverts

* **package:** reverts root package.json to fix CI ([277deb5](https://github.com/stalniy/ucast/commit/277deb561bc2a74a2c98170608805ded57802d7d))
