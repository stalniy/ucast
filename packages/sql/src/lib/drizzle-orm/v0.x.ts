import {
  getTableName,
  getTableUniqueName,
  is,
  isTable,
  Relations,
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  normalizeRelation,
  sql,
  SQL,
  entityKind,
  getTableColumns,
  type Column,
  type SQLChunk,
  type Table,
  type TablesRelationalConfig,
} from 'drizzle-orm-v0';
import { aliasedTable, aliasedTableColumn } from 'drizzle-orm-v0/alias';
import { allInterpreters, type SqlOperator } from '../../index.ts';
import {
  createBaseDrizzleInterpreter,
  createGetEntityName,
  hasOwn,
  SUPPORTED_TABLE_TYPES,
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
  getTableColumns,
  getEntityName,
  isSQL: value => is(value, SQL),
});

export function createDrizzleInterpreter<TConfig extends Record<string, unknown>>(
  options: DrizzleInterpreterOptions<TConfig>,
  operators: Record<string, SqlOperator<any, any>> = allInterpreters
): DrizzleInterpreter<TConfig> {
  return createInterpreter<TConfig>(operators, extractRelations(options.schema));
}

function extractRelations(schema: Record<string, unknown>) {
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
  const tableRelations: Record<string, Record<string, DrizzleRelationMetadata>>
    = Object.create(null);
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
        tableKey: targetKey,
        build({ sourceAlias, targetAlias }) {
          return { filter: sql.join(fields.map((field, index) =>
            sql`${aliasedTableColumn(field, sourceAlias)} = ${aliasedTableColumn(references[index], targetAlias)}`), sql.raw(' AND ')) };
        },
      };
    }
  }

  return {
    tables,
    resolveRelation: (key: string, name: string) =>
      tableRelations[relations.tableNamesMap[getTableUniqueName(tables[key])]]?.[name]
  }
}
