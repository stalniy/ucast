import config from '../../tsdown.config.mjs';

const entry = {
  index: 'src/index.ts',
  'lib/mikro-orm': 'src/lib/mikro-orm.ts',
  'lib/objection': 'src/lib/objection.ts',
  'lib/sequelize': 'src/lib/sequelize.ts',
  'lib/drizzle-orm/v0.x': 'src/lib/drizzle-orm/v0.x.ts',
  'lib/typeorm': 'src/lib/typeorm.ts',
};

export default config.map(options => ({
  ...options,
  entry,
  copy: {
    // Drizzle distributs different d.ts files for different modules
    // this causes issues for us, since types from drizzle's 2 modules are not assignable to each other
    from: 'dist/types/lib/drizzle-orm/v0.x.d.ts',
    to: 'dist/types/lib/drizzle-orm',
    rename: options.format === 'cjs' ? 'v0.x.d.cts' : 'v0.x.d.mts',
  },
}));
