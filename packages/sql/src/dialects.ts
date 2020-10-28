function posixRegex(field: string, placeholder: string, ignoreCase: boolean) {
  const operator = ignoreCase ? '~*' : '~';
  return `${field} ${operator} ${placeholder}`;
}

function regexp(field: string, placeholder: string) {
  return `${field} regexp ${placeholder} = 1`;
}

const questionPlaceholder = () => '?';
const $indexPlaceholder = (index: number) => `$${index}`;

export const oracle = {
  regexp: posixRegex,
  paramPlaceholder: $indexPlaceholder,
  escapeField: (field: string) => `"${field}"`,
};
export const pg = oracle;

export const mysql = {
  regexp,
  paramPlaceholder: questionPlaceholder,
  escapeField: (field: string) => `\`${field}\``,
};
export const sqlite = mysql;

export const mssql = {
  regexp() {
    throw new Error('"regexp" operator is not supported in MSSQL');
  },
  paramPlaceholder: questionPlaceholder,
  escapeField: (field: string) => `[${field}]`,
};

export interface DialectOptions {
  regexp(field: string, placeholder: string, ignoreCase: boolean): string
  joinRelation?(relationName: string, context: unknown): boolean
  escapeField(field: string, relationName?: string): string
  paramPlaceholder(index: number): string
}

export type SupportedDialects = 'mssql' |
'postgres' |
'pg' |
'oracle' |
'oracledb' |
'mysql' |
'mysql2' |
'mariadb' |
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
    mysql: mysqlOptions,
    mysql2: mysqlOptions,
    mariadb: mysqlOptions,
    sqlite: sqliteOptions,
    sqlite3: sqliteOptions,
  };
}
