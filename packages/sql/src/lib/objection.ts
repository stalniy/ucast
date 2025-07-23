import { Condition } from '@ucast/core';
import { Model, QueryBuilder } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  mysql,
} from '../index';
import { splitRelationName } from './utils';

function joinRelation(input: string, query: QueryBuilder<Model>) {
  let relationFullName : string | undefined = input;
  let modelClass = query.modelClass();

  while (relationFullName) {
    let relationName : string;
    [relationName, relationFullName] = splitRelationName(relationFullName);

    const relation = modelClass.getRelation(relationName);
    if (relation) {
      query.joinRelated(relationName);

      modelClass = relation.joinModelClass;
    } else {
      return false;
    }
  }

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
