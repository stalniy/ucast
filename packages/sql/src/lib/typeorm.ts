import { Condition } from '@ucast/core';
import { SelectQueryBuilder } from 'typeorm';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects
} from '../index';

function joinRelation<Entity>(input: string, query: SelectQueryBuilder<Entity>) {
  let relationFullName = input;
  let meta = query.expressionMap.mainAlias!.metadata;
  let alias : string | undefined = query.alias;

  while (relationFullName.length) {
    const separatorIndex = relationFullName.indexOf('.');

    let relationName : string;
    if (separatorIndex === -1) {
      relationName = relationFullName;
      relationFullName = '';
    } else {
      relationName = relationFullName.substring(0, separatorIndex);
      relationFullName = relationFullName.substring(separatorIndex + 1);
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

const typeormPlaceholder = (index: number) => `:${index - 1}`;

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: typeormPlaceholder,
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
