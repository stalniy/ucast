# Change Log

All notable changes to this project will be documented in this file.

## [1.10.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.10.0...@ucast/core@1.10.1) (2021-07-15)


### Bug Fixes

* remove type commonjs from package.json to improve webpack compat ([#28](https://github.com/stalniy/ucast/issues/28)) ([6b1ad28](https://github.com/stalniy/ucast/commit/6b1ad289d7b4f9945f08f29efd952069efd6c8c9))

# [1.10.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.9.0...@ucast/core@1.10.0) (2021-03-26)


### Features

* **parser:** adds support for `ignoreValue` at parser level ([49f8f3a](https://github.com/stalniy/ucast/commit/49f8f3a7221b718326ae125868f0ed24b9c93528))

# [1.9.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.8.2...@ucast/core@1.9.0) (2021-03-25)


### Features

* **parser:** moves `parseInstruction` under `ObjectQueryParser`. Skips `NULL_CONDITION` for all other operators and cases ([bec352e](https://github.com/stalniy/ucast/commit/bec352e3b98447da0d2b704b76446964025c34c9))

## [1.8.2](https://github.com/stalniy/ucast/compare/@ucast/core@1.8.1...@ucast/core@1.8.2) (2021-01-10)


### Bug Fixes

* **ast:** makes `_notes` to be non-enumerable on `Condition` ([57acee9](https://github.com/stalniy/ucast/commit/57acee91f0bd3c4eaa859461f026f6f6bd159d7b))

## [1.8.2](https://github.com/stalniy/ucast/compare/@ucast/core@1.8.1...@ucast/core@1.8.2) (2021-01-10)


### Bug Fixes

* **ast:** makes `_notes` to be non-enumerable on `Condition` ([57acee9](https://github.com/stalniy/ucast/commit/57acee91f0bd3c4eaa859461f026f6f6bd159d7b))

## [1.8.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.8.0...@ucast/core@1.8.1) (2021-01-10)


### Bug Fixes

* marks packages as commonjs by default with a separate ESM entry ([a3f4896](https://github.com/stalniy/ucast/commit/a3f48961a93b5951cb92d9954297cd12754d3ff1))

# [1.8.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.7.0...@ucast/core@1.8.0) (2020-12-02)


### Features

* **condition:** adds possibility to associate notes with parsed condition ([4468773](https://github.com/stalniy/ucast/commit/4468773fcd156feba2fa5f9b6d45d36d56edad20))
* **interpreter:** adds possibility to customize interpreter name detection ([39b0bc5](https://github.com/stalniy/ucast/commit/39b0bc52015ef794fb6d7360082a378ec2b9bdfe))

# [1.7.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.6.1...@ucast/core@1.7.0) (2020-11-23)


### Features

* **parser:** adds possibility to pass additional field and document level context ([5f32321](https://github.com/stalniy/ucast/commit/5f323219fd960ad764546182b8b54899830de389))

## [1.6.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.6.0...@ucast/core@1.6.1) (2020-11-02)


### Bug Fixes

* **parser:** prevents mangling of `parseField` and `parseFieldOperators` methods of `ObjectQueryParser` ([3b4734b](https://github.com/stalniy/ucast/commit/3b4734b8ac46514aa46855f169e48708d5a9a4b3))

# [1.6.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.5.0...@ucast/core@1.6.0) (2020-11-02)


### Features

* **parser:** extracts `ObjectQueryParser` out of `MongoQueryParser` into reusable piece ([38941dd](https://github.com/stalniy/ucast/commit/38941dd003dfb0ac9d9f7c867d49b0bbd0b5e716))

# [1.5.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.4.1...@ucast/core@1.5.0) (2020-08-20)


### Features

* **esm:** adds ESM support via dual loading in package.json for latest Node.js version ([c730f95](https://github.com/stalniy/ucast/commit/c730f9598a4c62589c612403c0ac59ba4aa1600e)), closes [#10](https://github.com/stalniy/ucast/issues/10)

## [1.4.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.4.0...@ucast/core@1.4.1) (2020-08-13)


### Bug Fixes

* **builder:** renames condition builder methods as they very likely to conflict with interpreter ([575efc9](https://github.com/stalniy/ucast/commit/575efc9fbe55e8bf235423a365abed5147e6dd39))

# [1.4.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.3.0...@ucast/core@1.4.0) (2020-08-13)


### Features

* **core:** exposes `optimizedCompoundCondition` and `and` and `or` helpers to construct optimized compound conditions ([2ae5584](https://github.com/stalniy/ucast/commit/2ae5584a4a382a1431656880f1ba201664b95e30))

# [1.3.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.2.1...@ucast/core@1.3.0) (2020-08-11)


### Features

* **intepreter:** adds possibility to specify amount of arguments used in interpreter ([e4ddcbd](https://github.com/stalniy/ucast/commit/e4ddcbd6c0602bd3be2befdfcd51ced37cebd158))

## [1.2.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.2.0...@ucast/core@1.2.1) (2020-08-11)


### Bug Fixes

* **translator:** prevents passing rest parameters from translator to parser ([83c6a56](https://github.com/stalniy/ucast/commit/83c6a56b4ecc66879af0de8deb62da7966080a56))

# [1.2.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.1.0...@ucast/core@1.2.0) (2020-08-08)


### Features

* **condition:** adds generic type to `Condition` interface ([a3f2961](https://github.com/stalniy/ucast/commit/a3f2961879e5bc20ee6379516ed7f0c3d58bd525))

# [1.1.0](https://github.com/stalniy/ucast/compare/@ucast/core@1.0.2...@ucast/core@1.1.0) (2020-08-08)


### Features

* **translator:** adds `ast` property to translate function ([814e874](https://github.com/stalniy/ucast/commit/814e87419a0162f8ef5210d497477d2da08e456a))


### Performance Improvements

* **build:** adds es6cjs format which works few times faster then umd in node env ([4adba3b](https://github.com/stalniy/ucast/commit/4adba3bbf85afe95abfbcee0e36b5edc9d09396f))

## [1.0.2](https://github.com/stalniy/ucast/compare/@ucast/core@1.0.1...@ucast/core@1.0.2) (2020-07-23)


### Bug Fixes

* **license:** changes mistakenly set MIT license to the correct one - Apache 2.0 ([197363c](https://github.com/stalniy/ucast/commit/197363c321392c742d31b7e1e024d88c0499ce73))

## [1.0.1](https://github.com/stalniy/ucast/compare/@ucast/core@1.0.0...@ucast/core@1.0.1) (2020-07-10)


### Bug Fixes

* **release:** adds build, test and lint prerelease step ([683a532](https://github.com/stalniy/ucast/commit/683a5327b6adb10fcd640ee60fc9479d7036cafc))

# 1.0.0 (2020-07-10)


### Features

* **core:** implements core helpers ([94c5a59](https://github.com/stalniy/ucast/commit/94c5a595fb32941dc0101dd0f468feeafc92329c))
* **mongo:** stabilize mongo package ([7d77768](https://github.com/stalniy/ucast/commit/7d7776874be3050026b53ee3b61c3361a89d1b21))


### Reverts

* **package:** reverts root package.json to fix CI ([277deb5](https://github.com/stalniy/ucast/commit/277deb561bc2a74a2c98170608805ded57802d7d))
