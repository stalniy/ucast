import { Condition } from '@ucast/core';
import { Model, QueryBuilder } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  sqlite,
  mssql,
  pg,
  oracle,
  mysql
} from '../index';

function joinRelation(relationName: string, query: QueryBuilder<Model>) {
  if (!query.modelClass().getRelation(relationName)) {
    return false;
  }

  query.joinRelated(relationName);
  return true;
}

const dialects = {
  mssql: {
    ...mssql,
    joinRelation,
    paramPlaceholder: mysql.paramPlaceholder,
  },
  postgres: {
    ...pg,
    joinRelation,
    paramPlaceholder: mysql.paramPlaceholder,
  },
  oracle: {
    ...oracle,
    joinRelation,
    paramPlaceholder: mysql.paramPlaceholder,
  },
  mysql: {
    ...mysql,
    joinRelation,
  },
  sqlite: {
    ...sqlite,
    joinRelation,
    paramPlaceholder: mysql.paramPlaceholder,
  },
};

Object.assign(dialects, {
  mysql2: dialects.mysql,
  oracledb: dialects.oracle,
  sqlite3: dialects.sqlite,
  pg: dialects.postgres,
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
