import {
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
