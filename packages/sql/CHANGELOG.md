# Changelog

## [0.3.0](https://github.com/stalniy/ucast/compare/@ucast/sql@0.2.1...@ucast/sql@0.3.0) (2026-10-23)


### ⚠ BREAKING CHANGES

* replaces Query & sql backend with sql composer

### Features

* adds drizzle-orm v0.x basic support ([d6cd2fa](https://github.com/stalniy/ucast/commit/d6cd2facb711755e9bd0358bc41ffa88a879ec4a))
* adds support for interpretation of some/every/none via drizzle relations ([5a33abf](https://github.com/stalniy/ucast/commit/5a33abf231c10b55c6b6a19675b2cd366af313ca))
* **sql:** adds support for drizzle 1.x ([#95](https://github.com/stalniy/ucast/issues/95)) ([1b46d93](https://github.com/stalniy/ucast/commit/1b46d93d0623359618ab23cad1f0de6323f740b4))
* **sql:** map model properties to database columns ([#90](https://github.com/stalniy/ucast/issues/90)) ([ecbabc0](https://github.com/stalniy/ucast/commit/ecbabc0515abe029d8814cc6a2ea0e53aaf2da64))


### Bug Fixes

* **sql:** fixes types build for ucast/sql ([d63e1f1](https://github.com/stalniy/ucast/commit/d63e1f16f9ed3bb592312878c76a239dc91b667b))


### Code Refactoring

* adjusts mikro-orm sql adapter to accept metadata storage and platform ([debfe25](https://github.com/stalniy/ucast/commit/debfe256f6cd4a05fe1bbdb376852e9b91865e39))
* changes typeorm adapter to return Brackets so it is composable with the rest of conditions ([5855057](https://github.com/stalniy/ucast/commit/5855057e51f378f0cfd1690433d8320e7cf63df0))
* migrates mikro-orm to new abstractions ([94a8b53](https://github.com/stalniy/ucast/commit/94a8b53718c51a9a597e535d0129ce13f718addf))
* migrates objection to new abstractions ([c401320](https://github.com/stalniy/ucast/commit/c401320b03afdd5923500d35d25011d28656a664))
* migrates sequelize interpreter to new abstraction ([f6775e8](https://github.com/stalniy/ucast/commit/f6775e8dbeac56e2346ede94d1fdf16ee4550fa9))
* migrates typeorm to new abstraction ([a5d558a](https://github.com/stalniy/ucast/commit/a5d558aea22d4a4551ea73faac28ea0f848c4876))
* refactors objection sql adapter to accept model instead of a query instance ([5af8b85](https://github.com/stalniy/ucast/commit/5af8b8530ae39d0ce5db439d14b9002180eb8c85))
* replaces Query & sql backend with sql composer ([385d19a](https://github.com/stalniy/ucast/commit/385d19ae56f200c6d7995d23cecac7495c89bd7e))
* uses double quotes for sqlite escaping instead of backticks which requires backslashes in tests ([a24b785](https://github.com/stalniy/ucast/commit/a24b785409de6eaa42338ad8b2293b8551500f3f))

## [0.2.1](https://github.com/stalniy/ucast/compare/@ucast/sql@0.2.0...@ucast/sql@0.2.1) (2026-06-28)


### Bug Fixes

* adds support for mikro-orm 7.x ([#88](https://github.com/stalniy/ucast/issues/88)) ([219b3b1](https://github.com/stalniy/ucast/commit/219b3b1ff556828f6a4ebe06067276cead59ad57))
* adds support for typeorm 1.x ([#86](https://github.com/stalniy/ucast/issues/86)) ([9c87d87](https://github.com/stalniy/ucast/commit/9c87d87176e621cc0fa539e7fedf37f1b7e129ce))

## [0.2.0](https://github.com/stalniy/ucast/compare/@ucast/sql@0.1.1...@ucast/sql@0.2.0) (2026-04-24)


### ⚠ BREAKING CHANGES

* supports ES2020+ only

### Code Refactoring

* drop ES5M and UMD builds ([#77](https://github.com/stalniy/ucast/issues/77)) ([14b8279](https://github.com/stalniy/ucast/commit/14b8279fa0dbd25d761ce7990afe692ae5bdbb95))

## [0.1.1](https://github.com/stalniy/ucast/compare/@ucast/sql@0.1.0...@ucast/sql@0.1.1) (2026-04-23)


### Bug Fixes

* **sql:** added support for mikro-orm@6 ([#73](https://github.com/stalniy/ucast/issues/73)) ([410e975](https://github.com/stalniy/ucast/commit/410e975836d70c134b1c7fe4b59618150c9de57b))

## [0.1.0](https://github.com/stalniy/ucast/compare/@ucast/sql@0.0.1...@ucast/sql@0.1.0) (2026-02-04)


### Features

* **esm:** adds ESM support via dual loading in package.json for latest Node.js version ([c730f95](https://github.com/stalniy/ucast/commit/c730f9598a4c62589c612403c0ac59ba4aa1600e)), closes [#10](https://github.com/stalniy/ucast/issues/10)
* **interpreter:** adds pure SQL interpreter ([de71fdb](https://github.com/stalniy/ucast/commit/de71fdb27288750772ccc588ecb3f84c2734b173))
* merges @ucast/sql alpha into main stream ([#68](https://github.com/stalniy/ucast/issues/68)) ([a058b3b](https://github.com/stalniy/ucast/commit/a058b3ba6fcea17e5d02dbe76b9fe1c6b8950624))
* **sequelize:** adds integration with sequelize ([1710361](https://github.com/stalniy/ucast/commit/17103618a21046352caf6da1b0589e338aaacb46))
* **sql:** adds integration for typeorm ([0524848](https://github.com/stalniy/ucast/commit/0524848314824451a49ccc3b6fa5b0b3940f8c2e))
* **sql:** adds sub-module for mikro-orm ([d477bed](https://github.com/stalniy/ucast/commit/d477bed59ea72f7c402023267c2116655f525f8e))


### Bug Fixes

* adds typings to ESM exports in package.json ([1ffb703](https://github.com/stalniy/ucast/commit/1ffb7033a6d70ee4eb5f9d3178bcb4df37da835e))
* updates metadata in package.json ([2fa89f5](https://github.com/stalniy/ucast/commit/2fa89f573eeb033c657b7c54b4640a856859f766))

## Change Log

All notable changes to this project will be documented in this file.

## [1.0.0-alpha.12](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.11...@ucast/sql@1.0.0-alpha.12) (2021-07-15)


### Bug Fixes

* **sql:** Interpreters should add one join per relation at most ([#24](https://github.com/stalniy/ucast/issues/24)) ([d725e35](https://github.com/stalniy/ucast/commit/d725e3528f0da11e27207ca8db7e1b6bf669fc34))

## [1.0.0-alpha.11](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.10...@ucast/sql@1.0.0-alpha.11) (2021-07-15)


### Bug Fixes

* adds commas to readme example ([cae1db2](https://github.com/stalniy/ucast/commit/cae1db2239fc17cc02d9ad704a998f40ff92192c))

## [1.0.0-alpha.10](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.9...@ucast/sql@1.0.0-alpha.10) (2021-01-25)


### Bug Fixes

* **sql:** adds brackets to SQL chunks during query merge in all cases ([ae65655](https://github.com/stalniy/ucast/commit/ae65655c77b8b9bf9938c81eb42231db052c3a1d))

## [1.0.0-alpha.9](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.8...@ucast/sql@1.0.0-alpha.9) (2020-12-02)


### Features

* **interpreter:** adds possibility to specify interpreter options ([701e951](https://github.com/stalniy/ucast/commit/701e951c6b004ab6c7f88d1221b7e4bcc73bc285))

## [1.0.0-alpha.8](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.7...@ucast/sql@1.0.0-alpha.8) (2020-11-26)


### Features

* **interpreter:** ignores dots in property name if `joinRelation` is not provided ([6682c2a](https://github.com/stalniy/ucast/commit/6682c2a4e25b8d99e55f47f200d75432029cca70))

## [1.0.0-alpha.7](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.6...@ucast/sql@1.0.0-alpha.7) (2020-11-26)


### Features

* **query:** adds possibility to provide custom query options when creating child query ([16b3844](https://github.com/stalniy/ucast/commit/16b38449ac58ccc1578dcbf56da33856d1a57c2b))

## [1.0.0-alpha.6](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.5...@ucast/sql@1.0.0-alpha.6) (2020-11-03)


### Bug Fixes

* copies collected relations from child to parent query ([9325219](https://github.com/stalniy/ucast/commit/9325219a4f0d25a56695ea2a97c6bb0618467b0c))

## [1.0.0-alpha.5](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.4...@ucast/sql@1.0.0-alpha.5) (2020-11-03)


### Features

* **sql:** reduce amount of array operations ([584a01a](https://github.com/stalniy/ucast/commit/584a01ab2d7d3b89932affa615acc352f1da3b79))

## [1.0.0-alpha.4](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.3...@ucast/sql@1.0.0-alpha.4) (2020-10-28)


### Features

* **interpreter:** adds support for local and foreign field name interception ([0b563c8](https://github.com/stalniy/ucast/commit/0b563c8b1c8a61d698a969223ebc9125820d500e))

## [1.0.0-alpha.3](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.2...@ucast/sql@1.0.0-alpha.3) (2020-10-17)


### Features

* **esm:** adds ESM support via dual loading in package.json for latest Node.js version ([c730f95](https://github.com/stalniy/ucast/commit/c730f9598a4c62589c612403c0ac59ba4aa1600e)), closes [#10](https://github.com/stalniy/ucast/issues/10)

## [1.0.0-alpha.2](https://github.com/stalniy/ucast/compare/@ucast/sql@1.0.0-alpha.1...@ucast/sql@1.0.0-alpha.2) (2020-08-19)


### Bug Fixes

* **lib:** changes paramPlaceholder for typeorm ([10b5fa8](https://github.com/stalniy/ucast/commit/10b5fa8441ad76adea0c60ae1bd151fce30f9fc2)), closes [#8](https://github.com/stalniy/ucast/issues/8)

## 1.0.0-alpha.1 (2020-08-18)


### Features

* **interpreter:** adds pure SQL interpreter ([de71fdb](https://github.com/stalniy/ucast/commit/de71fdb27288750772ccc588ecb3f84c2734b173)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sequelize:** adds integration with sequelize ([1710361](https://github.com/stalniy/ucast/commit/17103618a21046352caf6da1b0589e338aaacb46)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sql:** adds integration for typeorm ([0524848](https://github.com/stalniy/ucast/commit/0524848314824451a49ccc3b6fa5b0b3940f8c2e)), closes [#8](https://github.com/stalniy/ucast/issues/8)
* **sql:** adds sub-module for mikro-orm ([d477bed](https://github.com/stalniy/ucast/commit/d477bed59ea72f7c402023267c2116655f525f8e)), closes [#8](https://github.com/stalniy/ucast/issues/8)
