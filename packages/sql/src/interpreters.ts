import {
  Condition,
  CompoundCondition,
  FieldCondition,
  Comparable
} from '@ucast/core';
import { SqlOperator } from './interpreter';

export const eq: SqlOperator<FieldCondition> = (condition, query) => {
  return query.where(condition.field, '=', condition.value);
};

export const ne: typeof eq = (condition, query) => {
  return query.where(condition.field, '<>', condition.value);
};

export const lt: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<', condition.value);
};

export const lte: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<=', condition.value);
};

export const gt: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>', condition.value);
};

export const gte: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>=', condition.value);
};

export const exists: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.whereRaw(`${query.field(condition.field)} is ${condition.value ? 'not ' : ''}null`);
};

function manyParamsOperator(name: string): SqlOperator<FieldCondition<unknown[]>> {
  return (condition, query) => {
    return query.whereRaw(
      `${query.field(condition.field)} ${name}(${query.manyParams(condition.value).join(', ')})`,
      ...condition.value
    );
  };
}

export const within = manyParamsOperator('in');
export const nin = manyParamsOperator('not in');

export const mod: SqlOperator<FieldCondition<[number, number]>> = (condition, query) => {
  const params = query.manyParams(condition.value);
  const sql = `mod(${query.field(condition.field)}, ${params[0]}) = ${params[1]}`;
  return query.whereRaw(sql, ...condition.value);
};

type IElemMatch = SqlOperator<FieldCondition<Condition>>;
export const elemMatch: IElemMatch = (condition, query, { interpret }) => {
  return query.usingFieldPrefix(condition.field, () => interpret(condition.value, query));
};

export const regex: SqlOperator<FieldCondition<RegExp>> = (condition, query) => {
  const sql = query.options.regexp(
    query.field(condition.field),
    query.param(),
    condition.value.ignoreCase
  );
  return query.whereRaw(sql, condition.value.source);
};

function compoundOperator(combinator: 'and' | 'or', isInverted: boolean = false) {
  return ((node, query, { interpret }) => {
    const childQuery = query.child();
    node.value.forEach(condition => interpret(condition, childQuery));
    return query.merge(childQuery, combinator, isInverted);
  }) as SqlOperator<CompoundCondition>;
}

export const not = compoundOperator('and', true);
export const and = compoundOperator('and');
export const or = compoundOperator('or');
export const nor = compoundOperator('or', true);
