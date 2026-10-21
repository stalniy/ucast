import { type EntityMetadata, type EntityProperty } from '@mikro-orm/core';
import { type Condition } from '@ucast/core';
import {
  allInterpreters,
  createDialects,
  createSqlInterpreter,
  mysql,
  type SqlEntityMetadata,
  type SqlInterpreterOptions,
  type SqlStringComposerResult,
  type SqlOperator
} from '../index.ts';

export function createMikroORMInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  mikroOrmOptions: MikroOrmInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters, mikroOrmOptions);
  const dialects = createDialects({
    paramPlaceholder: mysql.paramPlaceholder,
  });

  return <T extends QueryBuilder>(condition: Condition, query: T): T => {
    const platformName = (query as any).platform.constructor.name;
    const dialect = platformName.slice(0, platformName.indexOf('Platform')).toLowerCase() as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database platform: ${platformName}`);
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      alias: query.alias,
      metadata: mikroOrmToSqlMetadata(getEntityMetadata(query)),
    });
    return query.where(sql, params as unknown[]);
  };
}

export const interpret = createMikroORMInterpreter(allInterpreters);

export interface MikroOrmInterpreterOptions
  extends SqlInterpreterOptions<string, SqlStringComposerResult> {
}

export function mikroOrmToSqlMetadata(entityMeta: EntityMetadata): SqlEntityMetadata {
  return new MikroORMSQLMetadata(entityMeta);
}

class MikroORMSQLMetadata implements SqlEntityMetadata {
  private readonly _meta: EntityMetadata;

  constructor(meta: EntityMetadata) {
    this._meta = meta;
  }

  toColumnName(field: string) {
    const property = this._meta.properties[field];
    if (!property) return field;
    const columns = property.fieldNames ?? [];
    if (columns.length > 1) {
      throw new Error(`Property "${field}" maps to multiple database columns, which is not supported`);
    }
    return columns[0] ?? field;
  }

  resolveRelation(relationName: string) {
    const prop = this._meta?.properties[relationName] as MikroOrmRelation | undefined;

    if (!prop?.targetMeta) {
      return undefined;
    }

    if (prop.kind === 'm:n') {
      const ownColumns = joinColumnPairs(
        prop.joinColumns,
        prop.referencedColumnNames,
        primaryColumnNames(this._meta)
      );
      const relatedColumns = joinColumnPairs(
        prop.inverseJoinColumns,
        primaryColumnNames(prop.targetMeta)
      );
      return {
        metadata: mikroOrmToSqlMetadata(prop.targetMeta),
        relatedTable: prop.targetMeta.tableName,
        ownField: ownColumns.map(pair => pair.relationField),
        relatedField: relatedColumns.map(pair => pair.relationField),
        through: {
          table: pivotTableName(prop),
          ownRelationField: ownColumns.map(pair => pair.throughField),
          relatedRelationField: relatedColumns.map(pair => pair.throughField),
        },
      };
    }

    const columnPairs = directRelationColumnPairs(prop);

    if (!columnPairs.length) {
      return undefined;
    }

    return {
      metadata: mikroOrmToSqlMetadata(prop.targetMeta),
      relatedTable: prop.targetMeta.tableName,
      ownField: columnPairs.map(pair => pair.parentField),
      relatedField: columnPairs.map(pair => pair.relationField),
    };
  }
}

function directRelationColumnPairs(prop: MikroOrmRelation) {
  if (prop.kind === 'm:1' || (prop.owner && prop.joinColumns?.length)) {
    return joinColumnPairs(
      prop.joinColumns,
      prop.referencedColumnNames,
      primaryColumnNames(prop.targetMeta)
    ).map(pair => ({
      parentField: pair.throughField,
      relationField: pair.relationField,
    }));
  }

  const mappedBy = prop.targetMeta
    .properties[prop.mappedBy as string] as MikroOrmRelation | undefined;

  if (!mappedBy?.joinColumns?.length) {
    return [];
  }

  return joinColumnPairs(
    mappedBy.joinColumns,
    mappedBy.referencedColumnNames,
    primaryColumnNames(prop.targetMeta),
  ).map(pair => ({
    parentField: pair.relationField,
    relationField: pair.throughField,
  }));
}

function pivotTableName(prop: MikroOrmRelation) {
  if (prop.pivotTable) {
    return prop.pivotTable;
  }

  const pivotEntity = prop.pivotEntity as string | { name?: string } | undefined;

  if (typeof pivotEntity === 'string') {
    return pivotEntity;
  }

  return pivotEntity!.name!;
}

function getEntityMetadata(query: QueryBuilder): EntityMetadata {
  const alias = query.mainAlias!;

  return (alias.meta ?? alias.metadata)!;
}

function joinColumnPairs(
  joinColumns: readonly string[],
  referencedColumns: readonly string[],
  fallbackReferencedColumns: readonly string[] = [],
) {
  return joinColumns.map((joinField, index) => ({
    throughField: joinField,
    relationField: referencedColumns[index] ?? fallbackReferencedColumns[index],
  }));
}

function primaryColumnNames(meta: EntityMetadata) {
  return meta.primaryKeys.map(key => meta.properties[key].fieldNames[0]);
}

interface QueryBuilder {
  alias: string;
  mainAlias?: {
    meta?: EntityMetadata;
    metadata?: EntityMetadata;
  };
  where(sql: string, params?: unknown[]): this;
}

type MikroOrmRelation = EntityProperty & {
  targetMeta: EntityMetadata;
};
