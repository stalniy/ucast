import { Condition } from '@ucast/core';
import { Model, QueryBuilder } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  mysql,
} from '../index';

function joinRelation(relationName: string, query: QueryBuilder<Model>) {
  try {
    query.modelClass().getRelation(relationName);
  } catch (e) {
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
  return <T extends Model>(condition: Condition, query: QueryBuilder<T>) => {
    const dialect = query.modelClass().knex().client.config.client as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error('Unsupported database dialect');
    }

    const [sql, params] = interpretSQL(condition, options, query);
    return query.whereRaw(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);
