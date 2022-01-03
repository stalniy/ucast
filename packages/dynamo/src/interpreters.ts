import { CompoundCondition, FieldCondition, Comparable } from '@ucast/core';
import { DynamoOperator } from './interpreter';

export const eq: DynamoOperator<FieldCondition> = (condition, query) => {
  return query.where(condition.field, '=', condition.value);
};

export const ne: DynamoOperator<FieldCondition> = (condition, query) => {
  return query.where(condition.field, '<>', condition.value);
};

export const lt: DynamoOperator<FieldCondition<Comparable>> = (
  condition,
  query
) => {
  return query.where(condition.field, '<', condition.value);
};

export const lte: DynamoOperator<FieldCondition<Comparable>> = (
  condition,
  query
) => {
  return query.where(condition.field, '<=', condition.value);
};

export const gt: DynamoOperator<FieldCondition<Comparable>> = (
  condition,
  query
) => {
  return query.where(condition.field, '>', condition.value);
};

export const gte: DynamoOperator<FieldCondition<Comparable>> = (
  condition,
  query
) => {
  return query.where(condition.field, '>=', condition.value);
};

export const exists: DynamoOperator<FieldCondition<Comparable>> = (
  condition,
  query
) => {
  if (condition.value) {
    return query.whereRaw(`attribute_exists(${query.field(condition.field)})`);
  }
  return query.whereRaw(
    `attribute_not_exists(${query.field(condition.field)})`
  );
};

function manyParamsOperator(
  name: string
): DynamoOperator<FieldCondition<unknown[]>> {
  return (condition, query) => {
    return query.whereRaw(
      `${query.field(condition.field)} ${name}(${query
        .manyParams(condition.value)
        .join(', ')})`
    );
  };
}

export const within = manyParamsOperator('IN');
export const nin = manyParamsOperator('NOT IN');

function compoundOperator(
  combinator: 'AND' | 'OR',
  isInverted: boolean = false
) {
  return ((node, query, { interpret }) => {
    const childQuery = query.child();
    node.value.forEach(condition => interpret(condition, childQuery));
    return query.merge(childQuery, combinator, isInverted);
  }) as DynamoOperator<CompoundCondition>;
}

export const not = compoundOperator('AND', true);
export const and = compoundOperator('AND');
export const or = compoundOperator('OR');
export const nor = compoundOperator('OR', true);
