import { type Condition } from '@ucast/core';
import { type EntityMetadata, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects,
  type SqlQueryOptions
} from '../index.ts';
import {
  buildDirectRelationQuery,
  buildManyToManyRelationQuery,
  RelationColumnPair,
  type ThroughRelationColumnPair,
} from '../relationUtils.ts';

type GetRelationMetadata = Exclude<SqlQueryOptions['getRelationMetadata'], undefined>;

export interface TypeOrmInterpreterOptions {
  getRelationMetadata?: GetRelationMetadata;
}

export const getRelationMetadata: GetRelationMetadata = (relationName, ctx) => {
  const meta = getEntityMetadata(ctx.relationContext);
  const relation = meta?.findRelationWithPropertyPath(relationName) as TypeOrmRelation | undefined;

  if (!relation) {
    return undefined;
  }

  if (relation.isManyToMany) {
    return buildManyToManyRelationMetadata(relation);
  }

  const isOwningSide = relation.joinColumns.length > 0;
  const joinColumns = isOwningSide ? relation.joinColumns : relation.inverseRelation?.joinColumns;

  if (!joinColumns?.length) {
    return undefined;
  }

  const columnPairs: RelationColumnPair[] = joinColumns.map(column => ({
    parentField: isOwningSide ? column.databaseName : column.referencedColumn!.databaseName,
    relationField: isOwningSide ? column.referencedColumn!.databaseName : column.databaseName,
  }));

  if (columnPairs.length === 1) {
    return {
      parentField: columnPairs[0].parentField,
      relationField: columnPairs[0].relationField,
      relationTable: relation.inverseEntityMetadata.tableName,
      relationContext: relation.inverseEntityMetadata,
    };
  }

  return {
    relationContext: relation.inverseEntityMetadata,
    buildRelationQuery: buildDirectRelationQuery(
      relation.inverseEntityMetadata.tableName,
      columnPairs,
    ),
  };
};

function createTypeOrmDialects(typeormOptions: TypeOrmInterpreterOptions = {}) {
  const dialects = createDialects({
    getRelationMetadata: typeormOptions.getRelationMetadata ?? getRelationMetadata,
    paramPlaceholder: index => `:${index - 1}`
  });

  dialects.sqlite.escapeField = dialects.sqlite3.escapeField =
    dialects['better-sqlite3'].escapeField = dialects.pg.escapeField;
  return dialects;
}

export function createInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  typeormOptions: TypeOrmInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters);
  const dialects = createTypeOrmDialects(typeormOptions);

  return <Entity extends ObjectLiteral>(
    condition: Condition,
    query: SelectQueryBuilder<Entity>,
  ) => {
    const dialect = getQueryDataSource(query)?.options.type as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      rootAlias: query.alias,
    }, query.expressionMap.mainAlias!.metadata);
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);

function getQueryDataSource<Entity extends ObjectLiteral>(query: SelectQueryBuilder<Entity>) {
  const typeormQuery = query as SelectQueryBuilder<Entity> & {
    connection?: TypeOrmDataSource;
    dataSource?: TypeOrmDataSource;
  };

  return typeormQuery.dataSource ?? typeormQuery.connection;
}

function buildManyToManyRelationMetadata(relation: TypeOrmRelation) {
  const ownerRelation = relation.isOwning ? relation : relation.inverseRelation;

  if (!ownerRelation?.junctionEntityMetadata) {
    return undefined;
  }

  const localColumns = relation.isOwning
    ? ownerRelation.joinColumns
    : ownerRelation.inverseJoinColumns;
  const foreignColumns = relation.isOwning
    ? ownerRelation.inverseJoinColumns
    : ownerRelation.joinColumns;

  return {
    relationContext: relation.inverseEntityMetadata,
    buildRelationQuery: buildManyToManyRelationQuery(
      ownerRelation.junctionEntityMetadata.tableName,
      relation.inverseEntityMetadata.tableName,
      localColumns.map(toJoinColumnPair),
      foreignColumns.map(toJoinColumnPair),
    ),
  };
}

function getEntityMetadata(context: unknown) {
  if (isEntityMetadata(context)) {
    return context;
  }

  return (context as SelectQueryBuilder<ObjectLiteral>).expressionMap?.mainAlias?.metadata;
}

function isEntityMetadata(context: unknown): context is EntityMetadata {
  return typeof (context as EntityMetadata | undefined)?.findRelationWithPropertyPath === 'function';
}

function toJoinColumnPair(column: TypeOrmColumn): ThroughRelationColumnPair {
  return {
    throughField: column.databaseName,
    relationField: column.referencedColumn!.databaseName,
  };
}

interface TypeOrmRelation {
  inverseEntityMetadata: EntityMetadata;
  inverseRelation?: TypeOrmRelation;
  isManyToMany: boolean;
  isOwning: boolean;
  joinColumns: TypeOrmColumn[];
  inverseJoinColumns: TypeOrmColumn[];
  junctionEntityMetadata?: EntityMetadata;
}

interface TypeOrmColumn {
  databaseName: string;
  referencedColumn?: TypeOrmColumn;
}

interface TypeOrmDataSource {
  options: {
    type?: string;
  };
}
