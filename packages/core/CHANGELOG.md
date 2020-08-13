# Change Log

All notable changes to this project will be documented in this file.

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
