const questionPlaceholder = () => '?';
const $indexPlaceholder = (index: number) => `$${index}`;

export const oracle = {
  features: {
    regex: { use: 'posix' },
    like: { use: 'native' },
    ilike: { use: 'lower' }
  },
  paramPlaceholder: $indexPlaceholder,
  escapeIdentifier: (name: string) => `"${name}"`,
} satisfies DialectOptions;
export const pg = {
  ...oracle,
  features: {
    regex: {
      use: 'posix',
    },
    like: { use: 'native', escapeCharacter: "E'\\\\'" },
    ilike: { use: 'native' }
  },
} satisfies DialectOptions;

export const mysql = {
  features: {
    regex: { use: 'regexp' },
    like: { use: 'native', escapeCharacter: `char(${'\\'.charCodeAt(0)})` },
    ilike: { use: 'lower' }
  },
  paramPlaceholder: questionPlaceholder,
  escapeIdentifier: (name: string) => `\`${name}\``,
} satisfies DialectOptions;
export const sqlite = {
  ...mysql,
  features: {
    regex: { use: 'regexp' },
    like: { ...mysql.features.like },
    ilike: { use: 'lower' }
  },
  escapeIdentifier: (name: string) => `"${name}"`,
} satisfies DialectOptions;

export const mssql = {
  features: {
    regex: { use: 'regexpLike' },
    like: { use: 'native', supportsBrackets: true },
    ilike: { use: 'lower', supportsBrackets: true }
  },
  paramPlaceholder: questionPlaceholder,
  escapeIdentifier: (name: string) => `[${name}]`,
} satisfies DialectOptions;

export type DialectOperators = {
  regex: {
    use: 'regexp' | 'posix' | 'regexpLike';
  }
  like: {
    use: 'native';
    supportsBrackets?: boolean;
    escapeCharacter?: string;
  }
  ilike: {
    use: 'native' | 'lower';
    supportsBrackets?: boolean;
    escapeCharacter?: string;
  }
};

export interface DialectOptions {
  features: DialectOperators;
  escapeIdentifier(name: string): string;
  paramPlaceholder(index: number): string;
}

export type SupportedDialects =
  | 'mssql'
  | 'postgres'
  | 'pg'
  | 'postgresql'
  | 'oracle'
  | 'oracledb'
  | 'mysql'
  | 'mysql2'
  | 'mariadb'
  | 'better-sqlite3'
  | 'sqlite3'
  | 'sqlite';
type Dialects<V> = Record<SupportedDialects, DialectOptions & V>;

export function createDialects<T extends Partial<DialectOptions>>(options: T): Dialects<T> {
  const configure = (dialect: DialectOptions) => ({
    ...dialect,
    ...options,
    features: {
      ...dialect.features,
      ...options.features,
    },
  });
  const mssqlOptions = configure(mssql);
  const pgOptions = configure(pg);
  const oracleOptions = configure(oracle);
  const mysqlOptions = configure(mysql);
  const sqliteOptions = configure(sqlite);

  return {
    mssql: mssqlOptions,
    oracle: oracleOptions,
    oracledb: oracleOptions,
    pg: pgOptions,
    postgres: pgOptions,
    postgresql: pgOptions,
    mysql: mysqlOptions,
    mysql2: mysqlOptions,
    mariadb: mysqlOptions,
    'better-sqlite3': sqliteOptions,
    sqlite: sqliteOptions,
    sqlite3: sqliteOptions,
  };
}
