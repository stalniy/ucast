import { type Condition } from '@ucast/core';
import { type ModelStatic, Utils, literal } from 'sequelize';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects,
  mysql
} from '../index';
import { splitRelationName, hasOwn } from './utils';

function joinRelation(relationPath: string, Model: ModelStatic<any>) {
  let relationFullName = relationPath;

  while (relationFullName) {
    let relationName: string;
    [relationName, relationFullName] = splitRelationName(relationFullName);

    if (!hasOwn(Model.associations, relationName)) {
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

  return (condition: Condition, Model: ModelStatic<any>) => {
    const dialect = Model.sequelize!.getDialect() as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params, joins] = interpretSQL(condition, options, Model);
    return {
      include: joins.map(association => ({ association, required: true })),
      where: literal(Utils.format([sql, ...(params as string[])], dialect)),
    };
  };
}

export const interpret = createInterpreter(allInterpreters);
