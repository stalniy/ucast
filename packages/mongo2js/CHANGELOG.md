# Change Log

All notable changes to this project will be documented in this file.

## [1.3.3](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.3.2...@ucast/mongo2js@1.3.3) (2021-07-15)


### Bug Fixes

* remove type commonjs from package.json to improve webpack compat ([#28](https://github.com/stalniy/ucast/issues/28)) ([6b1ad28](https://github.com/stalniy/ucast/commit/6b1ad289d7b4f9945f08f29efd952069efd6c8c9))

## [1.3.2](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.3.1...@ucast/mongo2js@1.3.2) (2021-01-10)


### Bug Fixes

* marks packages as commonjs by default with a separate ESM entry ([a3f4896](https://github.com/stalniy/ucast/commit/a3f48961a93b5951cb92d9954297cd12754d3ff1))

## [1.3.1](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.3.0...@ucast/mongo2js@1.3.1) (2020-10-17)


### Bug Fixes

* **package:** upgrades to the latest @ucast/js ([4d387d3](https://github.com/stalniy/ucast/commit/4d387d3c22e9f4682f32c246111f69c2f92f3964))

# [1.3.0](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.2.0...@ucast/mongo2js@1.3.0) (2020-08-20)


### Features

* **esm:** adds ESM support via dual loading in package.json for latest Node.js version ([c730f95](https://github.com/stalniy/ucast/commit/c730f9598a4c62589c612403c0ac59ba4aa1600e)), closes [#10](https://github.com/stalniy/ucast/issues/10)

# [1.2.0](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.1.1...@ucast/mongo2js@1.2.0) (2020-08-18)


### Features

* **mongo2js:** adds `squire` function for primitives and renames `filter` to `guard` ([683d813](https://github.com/stalniy/ucast/commit/683d81367e60282d0828f5b3e2fe1603c27f8f4e)), closes [#9](https://github.com/stalniy/ucast/issues/9)
* **mongo2js:** adds support for compound operators in primitive mongo query ([a4273a6](https://github.com/stalniy/ucast/commit/a4273a63a9442a130225681cfca75326c9799f42)), closes [#9](https://github.com/stalniy/ucast/issues/9)

## [1.1.1](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.1.0...@ucast/mongo2js@1.1.1) (2020-08-11)


### Bug Fixes

* **mongo2js:** removes `workspace:` protocol from deps ([5b6862d](https://github.com/stalniy/ucast/commit/5b6862d2c15573baf9578761372f0d19614922de))

# [1.1.0](https://github.com/stalniy/ucast/compare/@ucast/mongo2js@1.0.0...@ucast/mongo2js@1.1.0) (2020-08-11)


### Features

* **filter:** makes it possible to check complex values like ObjectId and Dates ([79a8a49](https://github.com/stalniy/ucast/commit/79a8a498387e0eba9adb1ebb147e7f25c39e9498))

# 1.0.0 (2020-08-08)


### Features

* **translator:** creates mongo to js package ([383143b](https://github.com/stalniy/ucast/commit/383143bc6e96e7c8af07f874bf3f3ad464c34db1))
