import { Condition } from '@ucast/core';
import { ModelStatic, Utils, literal } from 'sequelize';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  mysql
} from '../index';

const hasOwn = Object.hasOwn ||
  Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);

function joinRelation(relationName: string, Model: ModelStatic<any>) {
  return hasOwn(Model.associations, relationName);
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
