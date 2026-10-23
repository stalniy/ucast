import { Condition, type FieldCondition } from '@ucast/core';
import {
  createSqlInterpreter, mysql, pg, sqlite,
  type SqlComposer, type SqlOperator, type SqlQueryOptions,
} from '../../index.ts';

export const hasOwn = Object.hasOwn ?? ((hasOwnProperty) =>
  (object: object, key: PropertyKey) => hasOwnProperty(object, key)
)(Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty));

export interface DrizzleInterpreterOptions<TSchema extends Record<string, unknown>> {
  schema: TSchema;
}

export type TableKeys<TConfig, TTable> = {
  [K in keyof TConfig]: TConfig[K] extends TTable ? K : never;
}[keyof TConfig] & string;

export interface DrizzleQueryOptions {
  alias?: string;
}

export interface DrizzleRelationAliases {
  sourceAlias: string;
  targetAlias: string;
  junctionAlias?: string;
}

/** Normalized native relation; constraints remain independent of the child predicate. */
export interface DrizzleRelationMetadata<TTable, TSQL> {
  table: TTable;
  tableKey: string;
  junction?: TTable;
  build(aliases: DrizzleRelationAliases): { filter: TSQL; join?: TSQL };
}

export type DrizzleInterpreter<TSchema extends Record<string, unknown>, TTable, TSQL> = (
  condition: Condition, tableKey: TableKeys<TSchema, TTable>, options?: DrizzleQueryOptions
) => TSQL;

export const SUPPORTED_TABLE_TYPES = { PgTable: pg, MySqlTable: mysql, SQLiteTable: sqlite };
export function createGetEntityName(entityKind: symbol) {
  return (table: object): string | undefined => {
    let constructor = Object.getPrototypeOf(table).constructor as
      Record<symbol, string | undefined> | null;
    const entityName = constructor?.[entityKind];
    while (constructor) {
      const name = constructor[entityKind];
      if (name && hasOwn(SUPPORTED_TABLE_TYPES, name)) return name;
      constructor = Object.getPrototypeOf(constructor);
    }
    return entityName;
  };
}

export interface RelationAdapter<TTable, TSQL> {
  tables: Record<string, TTable>;
  resolveRelation(
    tableKey: string, name: string
  ): DrizzleRelationMetadata<TTable, TSQL> | undefined;
}

interface ComposerOptions<TTable, TSQL> extends Pick<SqlQueryOptions, 'regexp'> {
  table: TTable;
  tableKey: string;
  family: string;
  resolve(name: string, tableKey: string): DrizzleRelationMetadata<TTable, TSQL> | undefined;
  nextAlias(): string;
}

export interface DrizzleOperations<TTable, TColumn, TSQL extends TChunk, TChunk> {
  sql: {
    (strings: TemplateStringsArray, ...values: unknown[]): TSQL;
    identifier(name: string): TChunk;
    param(value: unknown, encoder?: TColumn): TChunk;
    raw(text: string): TSQL;
    join(chunks: TChunk[], separator: TChunk): TSQL;
  };
  aliasedTable(table: TTable, alias: string): TTable;
  getTableName(table: TTable): string;
  getTableColumns(table: TTable): Record<string, TColumn>;
  getEntityName(table: TTable): string | undefined;
  isSQL(value: unknown): boolean;
}

export function createBaseDrizzleInterpreter<
  TTable, TColumn extends TChunk, TSQL extends TChunk, TChunk
>(
  operations: DrizzleOperations<TTable, TColumn, TSQL, TChunk>
) {
  const { sql, aliasedTable, getTableName, getTableColumns, getEntityName, isSQL } = operations;

  function createInterpreter<TSchema extends Record<string, unknown>>(
    operators: Record<string, SqlOperator<any, any>>,
    adapter: RelationAdapter<TTable, TSQL>
  ) {
    const interpret = createSqlInterpreter<TChunk, TSQL, ComposerOptions<TTable, TSQL>>(operators, {
      createSqlComposer: createDrizzleSqlComposer,
    });
    return (
      condition: Condition,
      tableKey: TableKeys<TSchema, TTable>,
      options?: DrizzleQueryOptions
    ): TSQL => {
      if (!hasOwn(adapter.tables, tableKey)) {
        throw new Error(`Unknown table schema key: ${String(tableKey)}`);
      }
      const table = adapter.tables[tableKey];
      const family = getEntityName(table);
      if (!family || !hasOwn(SUPPORTED_TABLE_TYPES, family)) {
        throw new Error(`Uknown table type "${family}". Supported ${Object.keys(SUPPORTED_TABLE_TYPES).join(', ')}`);
      }
      const queryTable = options?.alias ? aliasedTable(table, options.alias) : table;
      const aliasPrefix = getTableName(queryTable);
      let index = 0;
      const dialect = SUPPORTED_TABLE_TYPES[family as keyof typeof SUPPORTED_TABLE_TYPES];
      return interpret(condition, {
        regexp: dialect.regexp,
        family,
        table: queryTable,
        tableKey,
        nextAlias: () => `${aliasPrefix}_ucast_${index++}`,
        resolve: (name, key) => adapter.resolveRelation(key, name),
      });
    };
  }

  function createDrizzleSqlComposer(options: ComposerOptions<TTable, TSQL>): SqlComposer<TChunk> {
    const columns: Record<string, TColumn> = getTableColumns(options.table);
    const column = (name: string) => hasOwn(columns, name) ? columns[name] : undefined;
    const param = (value: unknown, encoder?: TColumn) => {
      if (isSQL(value)) throw new Error('SQL fragments are not supported as condition values');
      return sql.param(value, encoder);
    };
    return {
      field: name => column(name)
        ?? sql`${sql.identifier(getTableName(options.table))}.${sql.identifier(name)}`,
      param(conditionOrValue) {
        if (conditionOrValue instanceof Condition) {
          const condition = conditionOrValue as FieldCondition;
          return param(condition.value, column(condition.field));
        }
        return param(conditionOrValue);
      },
      manyParams(conditionOrValues) {
        const condition = conditionOrValues instanceof Condition ? conditionOrValues : undefined;
        const values = condition ? condition.value : conditionOrValues as unknown[];
        const encoder = condition ? column(condition.field) : undefined;
        return sql.join(values.map(value => param(value, encoder)), sql.raw(', '));
      },
      sql,
      raw: sql.raw,
      join: sql.join,
      regexp: options.regexp,
      relation(name) {
        const relation = options.resolve(name, options.tableKey);
        if (!relation) throw new Error(`Relation metadata for "${getTableName(options.table)}.${name}" not found`);
        if (getEntityName(relation.table) !== options.family
          || (relation.junction && getEntityName(relation.junction) !== options.family)) {
          throw new Error('Cross-dialect relations are not supported');
        }
        const targetAlias = options.nextAlias();
        const junctionAlias = relation.junction ? options.nextAlias() : undefined;
        const relatedTable = aliasedTable(relation.table, targetAlias);
        const { filter, join } = relation.build({
          sourceAlias: getTableName(options.table), targetAlias, junctionAlias,
        });
        if (!filter || (relation.junction && !join)) throw new Error(`Invalid join for relation "${name}"`);
        const composer = createDrizzleSqlComposer({
          ...options,
          table: relatedTable,
          tableKey: relation.tableKey,
        });
        return {
          composer,
          subquery: predicate => relation.junction
            ? sql`SELECT 1 FROM ${relation.table} as ${sql.identifier(targetAlias)} INNER JOIN ${relation.junction} as ${sql.identifier(junctionAlias!)} ON ${join} WHERE (${filter}) AND (${predicate})`
            : sql`SELECT 1 FROM ${relation.table} as ${sql.identifier(targetAlias)} WHERE (${filter}) AND (${predicate})`,
        };
      },
    };
  }

  return createInterpreter;
}
