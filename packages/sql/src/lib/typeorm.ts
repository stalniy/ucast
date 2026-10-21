import { type Condition } from '@ucast/core';
import { Brackets, type EntityMetadata, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlEntityMetadata,
  type SqlInterpreterOptions,
  type SqlStringComposerResult,
  type RelationMetadata,
  type SqlOperator,
  createDialects,
} from '../index.ts';

export interface TypeOrmInterpreterOptions
  extends SqlInterpreterOptions<string, SqlStringComposerResult> {
}

let interpretationNumber = 0;

export function createTypeOrmInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  options: TypeOrmInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters, options);
  return (condition: Condition): Brackets => new Brackets((where) => {
    // TypeORM creates this child builder with the outer query's alias and connection.
    const query = where as SelectQueryBuilder<ObjectLiteral>;
    const prefix = `ucast_${interpretationNumber++}`;
    const dialects = createDialects({ paramPlaceholder: index => `:${prefix}_${index}` });
    const dialect = getQueryDataSource(query)?.options.type as keyof typeof dialects;
    const dialectOptions = dialects[dialect];
    if (!dialectOptions) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const metadata = query.expressionMap.mainAlias!.metadata;
    const [sql, params] = interpretSQL(condition, {
      ...dialectOptions,
      alias: query.alias,
      metadata: typeormToSqlMetadata(metadata),
    });
    const parameters: ObjectLiteral = {};
    for (let i = 0; i < params.length; i++) {
      parameters[`${prefix}_${i + 1}`] = params[i];
    }
    query.where(sql, parameters);
  });
}

export const interpret = createTypeOrmInterpreter(allInterpreters);

export function typeormToSqlMetadata(
  context: EntityMetadata | SelectQueryBuilder<any>,
): SqlEntityMetadata {
  return new TypeOrmSqlMetadata(getEntityMetadata(context));
}

class TypeOrmSqlMetadata implements SqlEntityMetadata {
  private readonly _meta: EntityMetadata | undefined;

  constructor(meta: EntityMetadata | undefined) {
    this._meta = meta;
  }

  toColumnName(field: string): string {
    const meta = this._meta;
    if (!meta) return field;
    const propertyColumns = meta.columns?.filter(column => column.propertyPath === field) ?? [];
    const columns = meta.findColumnsWithPropertyPath
      ? meta.findColumnsWithPropertyPath(field)
      : propertyColumns.length
        ? propertyColumns
        : meta.findRelationWithPropertyPath(field)?.joinColumns ?? [];
    if (columns.length > 1) {
      throw new Error(`Property "${field}" maps to multiple database columns, which is not supported`);
    }
    return columns[0]?.databaseName ?? field;
  }

  resolveRelation(name: string): RelationMetadata | undefined {
    const relation = this._meta?.findRelationWithPropertyPath(name) as TypeOrmRelation | undefined;
    if (!relation) return undefined;
    if (relation.isManyToMany) return manyToManyMetadata(relation);

    const isOwningSide = relation.joinColumns.length > 0;
    const columns = isOwningSide ? relation.joinColumns : relation.inverseRelation?.joinColumns;
    if (!columns?.length) return undefined;

    const columnPairs = columns.map(column => ({
      ownField: isOwningSide ? column.databaseName : column.referencedColumn!.databaseName,
      relatedField: isOwningSide ? column.referencedColumn!.databaseName : column.databaseName,
    }));
    return {
      metadata: typeormToSqlMetadata(relation.inverseEntityMetadata),
      relatedTable: relation.inverseEntityMetadata.tableName,
      ownField: columnPairs.map(pair => pair.ownField),
      relatedField: columnPairs.map(pair => pair.relatedField),
    };
  }
}

function getQueryDataSource<Entity extends ObjectLiteral>(query: SelectQueryBuilder<Entity>) {
  const typeormQuery = query as SelectQueryBuilder<Entity> & {
    connection?: TypeOrmDataSource;
    dataSource?: TypeOrmDataSource;
  };
  return typeormQuery.dataSource ?? typeormQuery.connection;
}

function manyToManyMetadata(relation: TypeOrmRelation): RelationMetadata | undefined {
  const owner = relation.isOwning ? relation : relation.inverseRelation;
  if (!owner?.junctionEntityMetadata) return undefined;

  const ownColumns = relation.isOwning ? owner.joinColumns : owner.inverseJoinColumns;
  const relatedColumns = relation.isOwning ? owner.inverseJoinColumns : owner.joinColumns;
  if (!ownColumns.length || !relatedColumns.length) return undefined;

  return {
    metadata: typeormToSqlMetadata(relation.inverseEntityMetadata),
    relatedTable: relation.inverseEntityMetadata.tableName,
    ownField: ownColumns.map(column => column.referencedColumn!.databaseName),
    relatedField: relatedColumns.map(column => column.referencedColumn!.databaseName),
    through: {
      table: owner.junctionEntityMetadata.tableName,
      ownRelationField: ownColumns.map(column => column.databaseName),
      relatedRelationField: relatedColumns.map(column => column.databaseName),
    },
  };
}

function getEntityMetadata(context: EntityMetadata | SelectQueryBuilder<any>) {
  if (typeof (context as EntityMetadata)?.findRelationWithPropertyPath === 'function') {
    return context as EntityMetadata;
  }
  return (context as SelectQueryBuilder<ObjectLiteral>)?.expressionMap?.mainAlias?.metadata;
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
  options: { type?: string };
}
