import { Condition, type FieldCondition } from '@ucast/core';
import {
  getTableColumns,
  getTableName,
  is,
  isTable,
  SQL,
  sql,
  type Column,
  type SQLChunk,
  type Table,
  entityKind
} from 'drizzle-orm';
import { aliasedTable } from 'drizzle-orm/alias';
import {
  allInterpreters,
  createSqlInterpreter,
  mysql,
  pg,
  sqlite,
  type SqlComposer,
  type SqlOperator,
  type SqlQueryOptions,
} from '../../index.ts';

const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));

type TableKey<TSchema> = {
  [K in keyof TSchema]: TSchema[K] extends Table ? K : never;
}[keyof TSchema] & string;

export interface DrizzleInterpreterOptions<TSchema extends Record<string, unknown>> {
  schema: TSchema;
}

export interface DrizzleQueryOptions {
  alias?: string;
}


const SUPPORTED_TABLE_TYPES = {
  PgTable: pg,
  MySqlTable: mysql,
  SQLiteTable: sqlite,
};
type SupportedTables = keyof typeof SUPPORTED_TABLE_TYPES;

export function createDrizzleInterpreter<TSchema extends Record<string, unknown>>(
  { schema }: DrizzleInterpreterOptions<TSchema>,
  operators: Record<string, SqlOperator<any, any>> = allInterpreters
) {
  const interpret = createSqlInterpreter<SQLChunk, SQL, DrizzleComposerOptions>(operators, {
    createSqlComposer: (options) => createDrizzleSqlComposer(options),
  });
  return (
    condition: Condition,
    tableName: TableKey<TSchema>,
    options?: DrizzleQueryOptions
  ): SQL => {
    const table = schema[tableName];
    if (!hasOwn(schema, tableName) || !isTable(table)) {
      throw new Error(`Unknown table schema key: ${String(tableName)}`);
    }

    const tableEntityName = getEntityName(table);
    if (!tableEntityName || !hasOwn(SUPPORTED_TABLE_TYPES, tableEntityName)) {
      throw new Error(`Uknown table type "${tableEntityName}". Supported ${Object.keys(SUPPORTED_TABLE_TYPES).join(', ')}`);
    }

    const dialectOptions = SUPPORTED_TABLE_TYPES[tableEntityName as SupportedTables];
    const queryTable = options?.alias
      ? aliasedTable(table, options.alias)
      : table;
    return interpret(condition, {
      ...dialectOptions,
      table: queryTable
    });
  };
}

interface DrizzleComposerOptions extends SqlQueryOptions {
  table: Table;
}

function getEntityName(table: Table) {
  const constructor = Object.getPrototypeOf(table).constructor as {
    [entityKind]?: string;
  };

  return constructor[entityKind];
}

function createDrizzleSqlComposer(options: DrizzleComposerOptions): SqlComposer<SQLChunk> {
  const columns: Record<string, Column> = getTableColumns(options.table);
  const column = (name: string): Column => {
    if (!hasOwn(columns, name)) {
      throw new Error(`Uknown column "${name}" on "${getTableName(options.table)}" table`);
    }
    return columns[name];
  };
  const param = (value: unknown, encoder?: Column) => {
    // Drizzle expands SQL objects even inside a Param. Reject them before rendering.
    if (is(value, SQL)) {
      throw new Error('SQL fragments are not supported as condition values');
    }
    return sql.param(value, encoder);
  };
  return {
    field: column,
    param(conditionOrValue) {
      if (conditionOrValue instanceof Condition) {
        const condition = conditionOrValue as FieldCondition;
        return param(condition.value, column(condition.field));
      }
      return param(conditionOrValue);
    },
    manyParams(conditionOrValues) {
      const condition = conditionOrValues instanceof Condition ? conditionOrValues : undefined;
      const values = conditionOrValues instanceof Condition
        ? conditionOrValues.value
        : conditionOrValues;
      const encoder = condition ? column(condition.field) : undefined;
      return sql.join(values.map(value => param(value, encoder)), sql.raw(', '));
    },
    sql,
    raw: sql.raw,
    join: sql.join,
    regexp: options.regexp,
    relation() {
      throw new Error('Not Supported');
    },
  };
}
