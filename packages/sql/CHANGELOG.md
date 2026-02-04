# Change Log

All notable changes to this project will be documented in this file.

# [1.0.0-alpha.12](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.11...@ucast/sql@1.0.0-alpha.12) (2021-07-15)


### Bug Fixes

* **sql:** Interpreters should add one join per relation at most ([#24](https://github.com/stalniy/ucast/issues/24)) ([d725e35](https://github.com/stalniy/ucast/commit/d725e3528f0da11e27207ca8db7e1b6bf669fc34))

# [1.0.0-alpha.11](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.10...@ucast/sql@1.0.0-alpha.11) (2021-07-15)


### Bug Fixes

* adds commas to readme example ([cae1db2](https://github.com/stalniy/ucast/commit/cae1db2239fc17cc02d9ad704a998f40ff92192c))

# [1.0.0-alpha.10](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.9...@ucast/sql@1.0.0-alpha.10) (2021-01-25)


### Bug Fixes

* **sql:** adds brackets to SQL chunks during query merge in all cases ([ae65655](https://github.com/stalniy/ucast/commit/ae65655c77b8b9bf9938c81eb42231db052c3a1d))

# [1.0.0-alpha.9](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.8...@ucast/sql@1.0.0-alpha.9) (2020-12-02)


### Features

* **interpreter:** adds possibility to specify interpreter options ([701e951](https://github.com/stalniy/ucast/commit/701e951c6b004ab6c7f88d1221b7e4bcc73bc285))

# [1.0.0-alpha.8](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.7...@ucast/sql@1.0.0-alpha.8) (2020-11-26)


### Features

* **interpreter:** ignores dots in property name if `joinRelation` is not provided ([6682c2a](https://github.com/stalniy/ucast/commit/6682c2a4e25b8d99e55f47f200d75432029cca70))

# [1.0.0-alpha.7](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.6...@ucast/sql@1.0.0-alpha.7) (2020-11-26)


### Features

* **query:** adds possibility to provide custom query options when creating child query ([16b3844](https://github.com/stalniy/ucast/commit/16b38449ac58ccc1578dcbf56da33856d1a57c2b))

# [1.0.0-alpha.6](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.5...@ucast/sql@1.0.0-alpha.6) (2020-11-03)


### Bug Fixes

* copies collected relations from child to parent query ([9325219](https://github.com/stalniy/ucast/commit/9325219a4f0d25a56695ea2a97c6bb0618467b0c))

# [1.0.0-alpha.5](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.4...@ucast/sql@1.0.0-alpha.5) (2020-11-03)


### Features

* **sql:** reduce amount of array operations ([584a01a](https://github.com/stalniy/ucast/commit/584a01ab2d7d3b89932affa615acc352f1da3b79))

# [1.0.0-alpha.4](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.3...@ucast/sql@1.0.0-alpha.4) (2020-10-28)


### Features

* **interpreter:** adds support for local and foreign field name interception ([0b563c8](https://github.com/stalniy/ucast/commit/0b563c8b1c8a61d698a969223ebc9125820d500e))

# [1.0.0-alpha.3](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.2...@ucast/sql@1.0.0-alpha.3) (2020-10-17)


### Features

* **esm:** adds ESM support via dual loading in package.json for latest Node.js version ([c730f95](https://github.com/stalniy/ucast/commit/c730f9598a4c62589c612403c0ac59ba4aa1600e)), closes [#10](https://github.com/stalniy/ucast/issues/10)

# [1.0.0-alpha.2](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.1...@ucast/sql@1.0.0-alpha.2) (2020-08-19)


### Bug Fixes

* **lib:** changes paramPlaceholder for typeorm ([10b5fa8](https://github.com/stalniy/ucast/commit/10b5fa8441ad76adea0c60ae1bd151fce30f9fc2)), closes [#8](https://github.com/stalniy/ucast/issues/8)

# 1.0.0-alpha.1 (2020-08-18)


### Features

* **interpreter:** adds pure SQL interpreter ([de71fdb](https://github.com/stalniy/ucast/commit/de71fdb27288750772ccc588ecb3f84c2734b173)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sequelize:** adds integration with sequelize ([1710361](https://github.com/stalniy/ucast/commit/17103618a21046352caf6da1b0589e338aaacb46)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sql:** adds integration for typeorm ([0524848](https://github.com/stalniy/ucast/commit/0524848314824451a49ccc3b6fa5b0b3940f8c2e)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sql:** adds sub-module for mikro-orm ([d477bed](https://github.com/stalniy/ucast/commit/d477bed59ea72f7c402023267c2116655f525f8e)), closes [#8](https://github.com/stalniy/ucast/issues/8)
