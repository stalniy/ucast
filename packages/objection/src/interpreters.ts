import {
  Condition,
  CompoundCondition,
  FieldCondition,
  Comparable
} from '@ucast/core';
import { ObjectionOperator } from './interpreter';
import { generateRegexQuery } from './utils';

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
  return query.orWhere(builder => node.value.forEach(condition => interpret(condition, builder)));
};

export const $nor: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  return query.orWhere((builder) => {
    node.value.forEach(condition => interpret(condition, builder));
  }, 'whereNot');
};

export const $mod: ObjectionOperator<FieldCondition<[number, number]>> = (condition, query) => {
  return query.whereRaw(condition.field, 'mod(:field:, :dividend) = :divider', {
    field: condition.field,
    dividend: condition.value[0],
    divider: condition.value[1]
  });
};

type IElemMatch = ObjectionOperator<FieldCondition<Condition>>;
export const $elemMatch: IElemMatch = (condition, query, { interpret }) => {
  interpret(condition.value, query.prefixed(condition.field));
  return query;
};

export const $regex: ObjectionOperator<FieldCondition<RegExp>> = (condition, query) => {
  return query.whereRaw(condition.field, generateRegexQuery(condition.value.ignoreCase), {
    field: condition.field,
    regex: condition.value.source,
  });
};
