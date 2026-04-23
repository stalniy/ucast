import config from '../../tsdown.config.mjs';

const entry = {
  index: 'src/index.ts',
  'lib/mikro-orm': 'src/lib/mikro-orm.ts',
  'lib/objection': 'src/lib/objection.ts',
  'lib/sequelize': 'src/lib/sequelize.ts',
  'lib/typeorm': 'src/lib/typeorm.ts',
};

export default config.map(options => ({
  ...options,
  entry,
}));
