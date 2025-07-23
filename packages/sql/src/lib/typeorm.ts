import { type Condition } from '@ucast/core';
import { type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects
} from '../index';

function joinRelation<Entity extends ObjectLiteral>(relationPath: string, query: SelectQueryBuilder<Entity>) {
  let relationFullName = relationPath;
  let meta = query.expressionMap.mainAlias!.metadata;
  let alias : string | undefined = query.alias;

  while (relationFullName.length) {
    const separatorIndex = relationFullName.indexOf('.');

    let relationName : string;
    if (separatorIndex === -1) {
      relationName = relationFullName;
      relationFullName = '';
    } else {
      relationName = relationFullName.slice(0, separatorIndex);
      relationFullName = relationFullName.slice(separatorIndex + 1);
    }

    const relation = meta.findRelationWithPropertyPath(relationName);
    if (relation) {
      query.innerJoin(`${alias}.${relationName}`, relationName);

      meta = relation.entityMetadata;
      alias = relationName;
    } else {
      return false;
    }
  }

  return true;
}

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: index => `:${index - 1}`
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
