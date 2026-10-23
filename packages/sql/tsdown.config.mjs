import { readFile, writeFile } from 'node:fs/promises';
import config from '../../tsdown.config.mjs';

const declarationDirectory = new URL('./dist/types/lib/drizzle-orm/', import.meta.url);
const drizzleAlias = /^drizzle-orm-v[01](?=\/|$)/;
const rewriteDrizzleImports = declaration => declaration.replace(
  /(['"])drizzle-orm-v[01](?=\/|\1)/g,
  '$1drizzle-orm',
);
const declarationSources = new Map();

const entry = {
  index: 'src/index.ts',
  'lib/mikro-orm': 'src/lib/mikro-orm.ts',
  'lib/objection': 'src/lib/objection.ts',
  'lib/sequelize': 'src/lib/sequelize.ts',
  'lib/drizzle-orm/v1.x': 'src/lib/drizzle-orm/v1.x.ts',
  'lib/drizzle-orm/v0.x': 'src/lib/drizzle-orm/v0.x.ts',
  'lib/typeorm': 'src/lib/typeorm.ts',
};

export default config.map(options => ({
  ...options,
  entry,
  deps: {
    ...options.deps,
    neverBundle: [...options.deps.neverBundle, drizzleAlias],
  },
  outputOptions: {
    paths: id => id.replace(drizzleAlias, 'drizzle-orm'),
  },
  hooks: {
    'build:done': async () => {
      const isEsm = options.format === 'esm';
      const mode = isEsm ? 'mts' : 'cts';
      const extension = isEsm ? 'mjs' : 'cjs';
      for (const name of ['base', 'v0.x', 'v1.x']) {
        const declarationUrl = new URL(`${name}.d.ts`, declarationDirectory);
        // Share the original read so CJS cannot read while ESM updates the file.
        if (!declarationSources.has(name)) {
          declarationSources.set(name, readFile(declarationUrl, 'utf8'));
        }
        const declaration = rewriteDrizzleImports(await declarationSources.get(name));
        await writeFile(new URL(`${name}.d.${mode}`, declarationDirectory),
          declaration.replaceAll('./base.ts', `./base.${extension}`));
        // ESM owns the shared declarations; each format writes its own variant.
        if (isEsm) await writeFile(declarationUrl, declaration);
      }
    },
  },
}));
