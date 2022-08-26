import { Condition } from '@ucast/core';
import { SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  SqlQueryOptions
} from '../index';

function joinRelation<Entity>(relation: string, query: SelectQueryBuilder<Entity>) {
  const relationParts = relation.split('.');
  let meta = query.expressionMap.mainAlias!.metadata;

  // eslint-disable-next-line no-restricted-syntax
  for (const part of relationParts) {
    const relationData = meta.findRelationWithPropertyPath(part);
    if (!relationData) {
      return false;
    }
    meta = relationData.inverseRelation!.entityMetadata;
  }

  relationParts.forEach((part, i) => {
    const alias = (i > 0) ? relationParts.slice(0, i).join('_') : query.expressionMap.mainAlias!.name;
    const nextJoinAlias = relationParts.slice(0, i + 1).join('_');
    if (!query.expressionMap.joinAttributes.some(j => j.alias.name === nextJoinAlias)) {
      query.leftJoin(`${alias}.${part}`, nextJoinAlias);
    }
  });
  return true;
}

function foreignField<Entity>(field: string, relationName: string) {
  return `${relationName.replace(/\./g, '_')}.${field}`;
}

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: index => `:${index - 1}`,
  foreignField
});

// eslint-disable-next-line no-multi-assign
dialects.sqlite.escapeField = dialects.sqlite3.escapeField = dialects.pg.escapeField;

export function createInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);

  return <Entity>(condition: Condition, query: SelectQueryBuilder<Entity>) => {
    const dialect = query.connection.options.type as keyof typeof dialects;
    if (!dialects[dialect]) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const options: SqlQueryOptions = {
      rootAlias: query.alias,
      ...dialects[dialect],
    };

    const [sql, params] = interpretSQL(condition, options, query);
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);
