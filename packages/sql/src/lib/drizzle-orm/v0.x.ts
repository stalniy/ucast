import { Condition, type FieldCondition } from '@ucast/core';
import {
  getTableColumns,
  getTableName,
  getTableUniqueName,
  is,
  isTable,
  SQL,
  sql,
  type Column,
  type SQLChunk,
  type Table,
  entityKind,
  Relations,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  normalizeRelation,
  type TablesRelationalConfig
} from 'drizzle-orm';
import { aliasedTableColumn, aliasedTable } from 'drizzle-orm/alias';
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

type Tables<TConfig> = {
  [K in keyof TConfig as TConfig[K] extends Table ? K : never]: Extract<TConfig[K], Table>;
};

export interface DrizzleInterpreterOptions<TSchema extends Record<string, Table>> {
  /** Original tables and relation declarations. Pass query aliases to interpret. */
  schema: TSchema & Record<string, unknown>;
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

export function createDrizzleInterpreter<TConfig extends Record<string, unknown>>(
  { schema }: { schema: TConfig } & DrizzleInterpreterOptions<Tables<TConfig>>,
  operators: Record<string, SqlOperator<any, any>> = allInterpreters
) {
  const { tables, tableRelations, relations } = categorizeSchema(schema);
  const interpret = createSqlInterpreter<SQLChunk, SQL, DrizzleComposerOptions>(operators, {
    createSqlComposer: createDrizzleSqlComposer,
  });

  return (
    condition: Condition,
    tableName: keyof Tables<TConfig> & string,
    options?: DrizzleQueryOptions
  ): SQL => {
    const table = tables[tableName];
    if (!hasOwn(tables, tableName)) {
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
    const aliasPrefix = getTableName(queryTable);
    let aliasIndex = 0;
    return interpret(condition, {
      ...dialectOptions,
      table: queryTable,
      relations: tableRelations[relations.tableNamesMap[getTableUniqueName(table)]],
      nextAlias: () => `${aliasPrefix}_ucast_${aliasIndex++}`
    });
  };
}

interface DrizzleComposerOptions extends SqlQueryOptions {
  table: Table;
  relations: Record<string, DrizzleRelation>;
  nextAlias(): string;
}

interface DrizzleRelation {
  table: Table;
  fields: Column[];
  references: Column[];
  relations: Record<string, DrizzleRelation>;
}

function categorizeSchema(schema: Record<string, unknown>) {
  const tables: Record<string, Table> = Object.create(null);
  const relationSchema: Record<string, unknown> = Object.create(null);
  const tableDefinitions: Record<string, Table> = Object.create(null);

  for (const [key, value] of Object.entries(schema)) {
    if (is(value, Relations)) {
      relationSchema[key] = value;
      continue;
    }

    if (!isTable(value)) continue;
    tables[key] = value;
    if (!hasOwn(SUPPORTED_TABLE_TYPES, getEntityName(value) || '')) continue;

    const uniqueName = getTableUniqueName(value);
    const existing = tableDefinitions[uniqueName];
    if (existing && existing !== value) {
      throw new Error(`Multiple table definitions for "${uniqueName}"`);
    }
    if (!existing) {
      tableDefinitions[uniqueName] = value;
      relationSchema[key] = value;
    }
  }

  const relations = extractTablesRelationalConfig<TablesRelationalConfig>(
    relationSchema,
    createTableRelationsHelpers
  );
  const tableRelations: Record<string, Record<string, DrizzleRelation>> = Object.create(null);
  const relationNames = Object.keys(relations.tables);
  for (const key of relationNames) {
    tableRelations[key] = Object.create(null);
  }

  for (const key of relationNames) {
    const tableConfig = relations.tables[key];

    for (const name of Object.keys(tableConfig.relations)) {
      const relation = tableConfig.relations[name];
      const targetKey = relations.tableNamesMap[getTableUniqueName(relation.referencedTable)];
      if (!targetKey || !hasOwn(relations.tables, targetKey)) {
        throw new Error(`Table "${getTableName(relation.referencedTable)}" not found in schema`);
      }
      if (getEntityName(relation.sourceTable) !== getEntityName(relation.referencedTable)) {
        throw new Error('Cross-dialect relations are not supported');
      }
      const { fields, references } = normalizeRelation(
        relations.tables,
        relations.tableNamesMap,
        relation
      );
      if (!fields.length || fields.length !== references.length) {
        throw new Error(`Invalid column pairs for relation "${name}"`);
      }
      tableRelations[key][name] = {
        table: relation.referencedTable,
        fields,
        references,
        relations: tableRelations[targetKey],
      };
    }
  }

  return {
    tables,
    tableRelations,
    relations
  }
}

function getEntityName(table: Table) {
  const constructor = Object.getPrototypeOf(table).constructor as {
    [entityKind]?: string;
  };

  return constructor[entityKind];
}

const AND = sql.raw(' AND ');

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
    relation(name) {
      if (!hasOwn(options.relations, name)) {
        throw new Error(`Relation metadata for "${getTableName(options.table)}.${name}" not found`);
      }

      const relation = options.relations[name];
      const alias = options.nextAlias();
      const relatedTable = aliasedTable(relation.table, alias);
      const relationComposer = createDrizzleSqlComposer({
        ...options,
        table: relatedTable,
        relations: relation.relations,
      });

      const parentTableName = getTableName(options.table);
      const joins = sql.join(relation.fields.map((field, index) =>
        sql`${aliasedTableColumn(field, parentTableName)} = ${aliasedTableColumn(relation.references[index], alias)}`),
        AND
      );

      return {
        composer: relationComposer,
        subquery: predicate => sql`SELECT 1 FROM ${relation.table} as ${sql.identifier(alias)} WHERE ${joins} AND ${predicate}`,
      };
    },
  };
}
