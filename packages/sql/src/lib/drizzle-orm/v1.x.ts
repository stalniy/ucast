import { SQL, sql, type SQLChunk } from 'drizzle-orm-v1/sql';
import type { Column } from 'drizzle-orm-v1/column';
import { getColumns } from 'drizzle-orm-v1/utils';
import { entityKind, is } from 'drizzle-orm-v1/entity';
import { getTableName, isTable, type Table } from "drizzle-orm-v1/table";
import { Relation, relationToSQL, type TableRelationalConfig } from "drizzle-orm-v1/relations";
import { aliasedTable } from 'drizzle-orm-v1/alias';
import { allInterpreters, type SqlOperator } from '../../index.ts';
import {
  createBaseDrizzleInterpreter, createGetEntityName, hasOwn,
  type DrizzleInterpreterOptions as BaseDrizzleInterpreterOptions,
  type DrizzleRelationMetadata as BaseDrizzleRelationMetadata,
  type DrizzleInterpreter as BaseDrizzleInterpreter,
} from './base.ts';
export type { DrizzleQueryOptions } from './base.ts';

export type DrizzleInterpreterOptions<TSchema extends Record<string, unknown>>
  = BaseDrizzleInterpreterOptions<TSchema>;
type DrizzleRelationMetadata = BaseDrizzleRelationMetadata<Table, SQL>;
type DrizzleInterpreter<TSchema extends Record<string, unknown>>
  = BaseDrizzleInterpreter<TSchema, Table, SQL>;

const getEntityName = createGetEntityName(entityKind);
const createInterpreter = createBaseDrizzleInterpreter<Table, Column, SQL, SQLChunk>({
  sql,
  aliasedTable,
  getTableName,
  getTableColumns: getColumns,
  getEntityName,
  isSQL: value => is(value, SQL),
});

export function createDrizzleInterpreter<TConfig extends Record<string, unknown>>(
  options: DrizzleInterpreterOptions<TConfig>,
  operators: Record<string, SqlOperator<any, any>> = allInterpreters
): DrizzleInterpreter<TConfig> {
  const tables: Record<string, Table> = Object.create(null);
  const declarations: Record<string, TableRelationalConfig> = Object.create(null);
  for (const [key, value] of Object.entries(options.schema)) {
    if (isTable(value)) tables[key] = value;
    else if (value && typeof value === 'object') {
      // defineRelations returns a map of native table configs, stored with the schema exports.
      for (const [name, config] of Object.entries(value)) {
        if (!config || !isTable(config.table) || !config.relations) continue;
        if (hasOwn(declarations, name) && declarations[name] !== config) {
          throw new Error(`Multiple relation declarations for "${name}"`);
        }
        declarations[name] = config;
      }
    }
  }
  const metadata: Record<string, Record<string, DrizzleRelationMetadata>> = Object.create(null);
  for (const [key, config] of Object.entries(declarations)) {
    if (!hasOwn(tables, key) || tables[key] !== config.table) {
      throw new Error(`Table "${key}" not found in schema`);
    }
    metadata[key] = Object.create(null);
    for (const [name, relation] of Object.entries(config.relations)) {
      if (!is(relation, Relation) || !isTable(relation.targetTable)
        || !hasOwn(tables, relation.targetTableName)
        || tables[relation.targetTableName] !== relation.targetTable) {
        throw new Error(`Unsupported metadata for relation "${key}.${name}"`);
      }
      const family = getEntityName(config.table);
      if (getEntityName(relation.targetTable) !== family
        || (relation.throughTable && getEntityName(relation.throughTable as Table) !== family)) {
        throw new Error('Cross-dialect relations are not supported');
      }
      if (!relation.sourceColumns.length
        || (!relation.through && relation.sourceColumns.length !== relation.targetColumns.length)
        || (relation.through && (!isTable(relation.throughTable)
          || relation.through.source.length !== relation.sourceColumns.length
          || relation.through.target.length !== relation.targetColumns.length))) {
        throw new Error(`Invalid column pairs for relation "${name}"`);
      }
      metadata[key][name] = {
        table: relation.targetTable,
        tableKey: relation.targetTableName,
        junction: relation.throughTable as Table | undefined,
        build({ sourceAlias, targetAlias, junctionAlias }) {
          const { filter, joinCondition } = relationToSQL(
            relation,
            aliasedTable(config.table, sourceAlias),
            aliasedTable(relation.targetTable, targetAlias),
            relation.throughTable && junctionAlias
              ? aliasedTable(relation.throughTable, junctionAlias) : undefined,
          );
          if (!filter) throw new Error(`Invalid join for relation "${name}"`);
          return { filter, join: joinCondition };
        },
      };
    }
  }
  return createInterpreter<TConfig>(operators, {
    tables,
    resolveRelation: (key, name) => hasOwn(metadata[key] || {}, name)
      ? metadata[key][name] : undefined,
  });
}
