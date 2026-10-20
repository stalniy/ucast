const POSIX_REGEXP = Object.freeze({
  true: {
    operator: '~*',
    comparator: '',
  },
  false: {
    operator: '~',
    comparator: ''
  }
} as const);

function posixRegex(ignoreCase: boolean) {
  const type = ignoreCase ? 'true' : 'false';
  return POSIX_REGEXP[type];
}

const REGEXP = Object.freeze({
  operator: 'regexp',
  comparator: ' = 1'
});
function regexp() {
  return REGEXP;
}

const questionPlaceholder = () => '?';
const $indexPlaceholder = (index: number) => `$${index}`;

export const oracle = {
  regexp: posixRegex,
  paramPlaceholder: $indexPlaceholder,
  escapeIdentifier: (name: string) => `"${name}"`,
};
export const pg = { ...oracle };

export const mysql = {
  regexp,
  paramPlaceholder: questionPlaceholder,
  escapeIdentifier: (name: string) => `\`${name}\``,
};
export const sqlite = {
  ...mysql,
  escapeIdentifier: (name: string) => `"${name}"`,
};

export const mssql = {
  regexp() {
    throw new Error('"regexp" operator is not supported in MSSQL');
  },
  paramPlaceholder: questionPlaceholder,
  escapeIdentifier: (name: string) => `[${name}]`,
};

export interface DialectOptions {
  regexp(ignoreCase: boolean): { operator: string; comparator: string; }
  escapeIdentifier(name: string, relationName?: string): string
  paramPlaceholder(index: number): string
}

export type SupportedDialects = 'mssql' |
'postgres' |
'pg' |
'postgresql' |
'oracle' |
'oracledb' |
'mysql' |
'mysql2' |
'mariadb' |
'better-sqlite3' |
'sqlite3' |
'sqlite';
type Dialects<V> = Record<SupportedDialects, DialectOptions & V>;

export function createDialects<T extends Partial<DialectOptions>>(options: T): Dialects<T> {
  const mssqlOptions = {
    ...mssql,
    ...options,
  };
  const pgOptions = {
    ...pg,
    ...options,
  };
  const oracleOptions = {
    ...oracle,
    ...options,
  };
  const mysqlOptions = {
    ...mysql,
    ...options,
  };
  const sqliteOptions = {
    ...sqlite,
    ...options,
  };

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
