import { type EntityMetadata, type EntityProperty } from '@mikro-orm/core';
import { type Condition } from '@ucast/core';
import {
  allInterpreters,
  createDialects,
  createSqlInterpreter,
  mysql,
  type SqlQueryOptions,
  type SqlOperator
} from '../index.ts';
import {
  buildDirectRelationQuery,
  buildManyToManyRelationQuery,
  RelationColumnPair,
  type ThroughRelationColumnPair,
} from '../relationUtils.ts';

type GetRelationMetadata = Exclude<SqlQueryOptions['getRelationMetadata'], undefined>;

export interface MikroOrmInterpreterOptions {
  getRelationMetadata?: GetRelationMetadata;
}

export const getRelationMetadata: GetRelationMetadata = (relationName, ctx) => {
  const meta = getEntityMetadata(ctx.relationContext);
  const prop = meta?.properties[relationName] as MikroOrmRelation | undefined;

  if (!prop?.targetMeta) {
    return undefined;
  }

  if (prop.kind === 'm:n') {
    return {
      relationContext: prop.targetMeta,
      buildRelationQuery: buildManyToManyRelationQuery(
        prop.pivotTable || prop.pivotEntity,
        prop.targetMeta.tableName,
        joinColumnPairs(prop.joinColumns, prop.referencedColumnNames, primaryColumnNames(meta)),
        joinColumnPairs(prop.inverseJoinColumns, primaryColumnNames(prop.targetMeta)),
      ),
    };
  }

  const columnPairs = directRelationColumnPairs(prop);

  if (!columnPairs.length) {
    return undefined;
  }

  if (columnPairs.length === 1) {
    return {
      parentField: columnPairs[0].parentField,
      relationField: columnPairs[0].relationField,
      relationTable: prop.targetMeta.tableName,
      relationContext: prop.targetMeta,
    };
  }

  return {
    relationContext: prop.targetMeta,
    buildRelationQuery: buildDirectRelationQuery(prop.targetMeta.tableName, columnPairs),
  };
};

function createMikroOrmDialects(mikroOrmOptions: MikroOrmInterpreterOptions = {}) {
  return createDialects({
    getRelationMetadata: mikroOrmOptions.getRelationMetadata ?? getRelationMetadata,
    paramPlaceholder: mysql.paramPlaceholder,
  });
}

export function createInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  mikroOrmOptions: MikroOrmInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters);
  const dialects = createMikroOrmDialects(mikroOrmOptions);

  return <T extends QueryBuilder>(condition: Condition, query: T) => {
    const platformName = (query as any).platform.constructor.name;
    const dialect = platformName.slice(0, platformName.indexOf('Platform')).toLowerCase() as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      rootAlias: query.alias,
    }, getEntityMetadata(query));
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);

function directRelationColumnPairs(prop: MikroOrmRelation): RelationColumnPair[] {
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

function getEntityMetadata(context: unknown): EntityMetadata {
  if (isEntityMetadata(context)) {
    return context;
  }

  return (context as QueryBuilder).mainAlias!.metadata!;
}

function isEntityMetadata(context: unknown): context is EntityMetadata {
  return !!(context as EntityMetadata | undefined)?.properties;
}

function joinColumnPairs(
  joinColumns: readonly string[],
  referencedColumns: readonly string[],
  fallbackReferencedColumns: readonly string[] = [],
): ThroughRelationColumnPair[] {
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
    metadata?: EntityMetadata;
  };
  where(sql: string, params?: unknown[]): this;
}

type MikroOrmRelation = EntityProperty & {
  targetMeta: EntityMetadata;
};
