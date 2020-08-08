# Change Log

All notable changes to this project will be documented in this file.

# [2.0.0](https://github.com/stalniy/ucast/compare/@ucast/objection@1.0.0...@ucast/objection@2.0.0) (2020-08-08)


### Bug Fixes

* **docs:** removes `$` sign from README examples ([44a8383](https://github.com/stalniy/ucast/commit/44a8383655f64f5acda93cc56dba0b6df8366143))


### Code Refactoring

* **interpreters:** removes `$` prefix from names of operator interpreters ([377d89f](https://github.com/stalniy/ucast/commit/377d89fef27f83a7d09052c43b3b44ebd64d3f09))


### BREAKING CHANGES

* **interpreters:** removes `$` prefix from names of operator interpreters. Also renames `$in` to `within` because `in` is a reserved word in JS. This ensures we can safely import/re-export symbols from this package and other parsers/interpreters inside/from single file:

**Before**:

```js
import { $in, $and } from '@ucast/objection'
```

**After**:

```js
import { within, and } from '@ucast/objection'
```

# 1.0.0 (2020-07-24)


### Features

* **interpreter:** adds interpreter for objection.js ORM ([#6](https://github.com/stalniy/ucast/issues/6)) ([f8815b7](https://github.com/stalniy/ucast/commit/f8815b792ea17b12be27713e2cf165c1f8a0d8e3))
