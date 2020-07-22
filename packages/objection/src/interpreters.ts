import {
  Condition,
  CompoundCondition,
  FieldCondition,
  Comparable
} from '@ucast/core';
import { Query, ObjectionOperator } from './interpreter';
import { renameFields } from './utils';

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
  const notQuery = new Query(query.query, 'whereNot');
  node.value.forEach(condition => interpret(condition, notQuery));
  return query;
};

export const $and: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  return node.value.reduce((builder, condition) => interpret(condition, builder), query);
};

export const $or: ObjectionOperator<CompoundCondition> = (node, query, { interpret }) => {
  const orQuery = new Query(query.query, 'orWhere');
  node.value.forEach(condition => interpret(condition, orQuery));
  return query;
};

export const $nor: ObjectionOperator<CompoundCondition> = (node, query, context) => {
  query.query.whereNot(builder => $and(node, new Query(builder), context).query);
  return query;
};

export const $mod: ObjectionOperator<FieldCondition<[number, number]>> = (condition, query) => {
  query.whereRaw(condition.field, 'mod(:field:, :num1) = :num2', { field: condition.field, num1: condition.value[0], num2: condition.value[1] });
  return query;
};

type IMatch = ObjectionOperator<FieldCondition<Condition>>;
export const $elemMatch: IMatch = (condition, query, { interpret }) => {
  const renamedCondition = renameFields(condition.value, condition.field);
  interpret(renamedCondition, query);
  return query;
};
