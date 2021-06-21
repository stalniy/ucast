import { Condition } from '@ucast/core';
import { SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects
} from '../index';

function joinRelation<Entity>(relationName: string, query: SelectQueryBuilder<Entity>) {
  const meta = query.expressionMap.mainAlias!.metadata;

  const joinAlreadyExists = query.expressionMap.joinAttributes.find((j) => {
    return j.alias.name === relationName;
  });
  if (joinAlreadyExists) {
    return true;
  }

  const relation = meta.findRelationWithPropertyPath(relationName);
  if (relation) {
    query.innerJoin(`${query.alias}.${relationName}`, relationName);
    return true;
  }

  return false;
}

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: index => `:${index - 1}`
});

// eslint-disable-next-line no-multi-assign
dialects.sqlite.escapeField = dialects.sqlite3.escapeField = dialects.pg.escapeField;

export function createInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);

  return <Entity>(condition: Condition, query: SelectQueryBuilder<Entity>) => {
    const dialect = query.connection.options.type as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, options, query);
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);
