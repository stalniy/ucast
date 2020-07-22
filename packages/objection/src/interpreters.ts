import {
  Condition,
  CompoundCondition,
  FieldCondition,
  Comparable
} from '@ucast/core';
import { Query, ObjectionOperator } from './interpreter';

export const $eq: ObjectionOperator<FieldCondition> = (condition, query) => {
  return query.where(condition.field, '=', condition.value);
};

export const $ne: ObjectionOperator<FieldCondition> = (condition, query) => {
  return query.where(condition.field, 'Not', condition.value);
};

export const $lt: ObjectionOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<', condition.value);
};

export const $lte: ObjectionOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<=', condition.value);
};

export const $gt: ObjectionOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>', condition.value);
};

export const $gte: ObjectionOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>=', condition.value);
};

export const $exists: ObjectionOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, condition.value ? 'NotNull' : 'Null', condition.value);
};

export const $in: ObjectionOperator<FieldCondition<Comparable[]>> = (condition, query) => {
  return query.where(condition.field, 'In', condition.value);
};

export const $nin: ObjectionOperator<FieldCondition<Comparable[]>> = (condition, query) => {
  return query.where(condition.field, 'NotIn', condition.value);
};

export const $not: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  const notQuery = query.buildUsing('whereNot');
  node.value.forEach(condition => interpret(condition, notQuery));
  return query;
};

export const $and: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  return node.value.reduce((builder, condition) => interpret(condition, builder), query);
};

export const $or: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  const orQuery = query.buildUsing('orWhere', query.query.clone());
  node.value.forEach(condition => interpret(condition, orQuery));
  query.query.where(builder => orQuery.applyTo(builder));
  return query;
};

export const $nor: ObjectionOperator<CompoundCondition> = (node, query, context) => {
  query.query.whereNot(builder => $and(node, new Query(builder), context).query);
  return query;
};

export const $mod: ObjectionOperator<FieldCondition<[number, number]>> = (condition, query) => {
  return query.whereRaw(condition.field, 'mod(:field:, :dividend) = :divider', {
    field: condition.field,
    dividend: condition.value[0],
    divider: condition.value[1]
  });
};

type IMatch = ObjectionOperator<FieldCondition<Condition>>;
export const $elemMatch: IMatch = (condition, query, { interpret }) => {
  interpret(condition.value, query.prefixed(condition.field));
  return query;
};
