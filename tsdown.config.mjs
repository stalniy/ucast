import { join } from 'node:path';
import { defineConfig } from 'tsdown';

const cwd = process.cwd();
const minify = process.env.NODE_ENV === 'production';

const shared = {
  entry: {
    index: join(cwd, 'src/index.ts'),
  },
  target: 'es2020',
  sourcemap: true,
  clean: false,
  dts: false,
  minify,
  platform: 'neutral',
  inputOptions: {
    resolve: {
      mainFields: ['module', 'main', 'browser'],
    },
  },
  deps: {
    skipNodeModulesBundle: true,
    neverBundle: [/^@ucast\//],
  },
  outExtensions({ format }) {
    return {
      js: format === 'cjs' ? '.js' : '.mjs',
    };
  },
};

export default defineConfig([
  {
    ...shared,
    format: 'esm',
    outDir: join(cwd, 'dist/esm'),
  },
  {
    ...shared,
    format: 'cjs',
    outDir: join(cwd, 'dist/cjs'),
  },
]);
