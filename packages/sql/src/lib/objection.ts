import { Condition } from '@ucast/core';
import { Model, QueryBuilder } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  SqlQueryOptions,
  createDialects,
  mysql,
} from '../index';

function joinRelation(relationName: string, query: QueryBuilder<Model>) {
  if (!query.modelClass().getRelation(relationName)) {
    return false;
  }

  query.joinRelated(relationName);
  return true;
}

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: mysql.paramPlaceholder,
});

export function createInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);
  return <T extends Model>(
    condition: Condition,
    query: QueryBuilder<T>,
    sqlOptions?: Partial<SqlQueryOptions>,
  ) => {
    const dialect = query.modelClass().knex().client.config.client as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error('Unsupported database dialect');
    }

    const [sql, params] = interpretSQL(condition, { ...options, ...sqlOptions }, query);
    return query.whereRaw(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);
