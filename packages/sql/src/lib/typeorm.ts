import { Condition } from '@ucast/core';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects
} from '../index';

function joinRelation<Entity extends ObjectLiteral>(
  relationName: string,
  query: SelectQueryBuilder<Entity>,
) {
  const meta = query.expressionMap.mainAlias!.metadata;
  const relation = meta.findRelationWithPropertyPath(relationName);

  if (relation) {
    query.innerJoin(`${query.alias}.${relationName}`, relationName);
    return true;
  }

  return false;
}

const typeormPlaceholder = (index: number) => `:${index - 1}`;

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: typeormPlaceholder,
});

 
dialects.sqlite.escapeField = dialects.sqlite3.escapeField = dialects.pg.escapeField;

export function createInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);

  return <Entity extends ObjectLiteral>(
    condition: Condition,
    query: SelectQueryBuilder<Entity>,
  ) => {
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
