import {
  CompoundCondition as Compound,
  FieldCondition as Field,
  DocumentCondition as Document,
  Condition,
  Comparable,
  ITSELF,
} from "@ucast/core";
import { JsOperator } from './interpreter';
import { includes, AnyObject } from './utils';

export const $or: JsOperator<Compound> = (node, object, { interpret }) => {
  return node.value.some(condition => interpret(condition, object));
};

export const $nor: typeof $or = (node, object, context) => {
  return !$or(node, object, context);
};

export const $and: JsOperator<Compound> = (node, object, { interpret }) => {
  return node.value.every(condition => interpret(condition, object));
};

export const $not: JsOperator<Compound> = (node, object, { interpret }) => {
  return !interpret(node.value[0], object);
};

export const $eq: JsOperator<Field> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value) && !Array.isArray(node.value)) {
    return includes(value, node.value, equal);
  }

  return equal(value, node.value);
};

export const $ne: typeof $eq = (node, object, context) => {
  return !$eq(node, object, context);
};

export const $lte: JsOperator<Field<Comparable>, AnyObject | Comparable> = (node, object, { get }) => {
  return get(object, node.field) <= node.value;
};

export const $lt: JsOperator<Field<Comparable>, AnyObject | Comparable> = (node, object, { get }) => {
  return get(object, node.field) < node.value;
};

export const $gt: JsOperator<Field<Comparable>, AnyObject | Comparable> = (node, object, { get }) => {
  return get(object, node.field) > node.value;
};

export const $gte: JsOperator<Field<Comparable>, AnyObject | Comparable> = (node, object, { get }) => {
  return get(object, node.field) >= node.value;
};

export const $exists: JsOperator<Field<boolean>> = (node, object, { get }) => {
  if (node.field === ITSELF) {
    return typeof object !== 'undefined';
  }

  let item = object;
  let field = node.field;
  const dotIndex = node.field.lastIndexOf('.');

  if (dotIndex !== -1) {
    field = node.field.slice(dotIndex + 1);
    item = get(item, node.field.slice(0, dotIndex));
  }

  return !!item && item.hasOwnProperty(field) === node.value;
};

export const $mod: JsOperator<Field<[number, number]>, AnyObject | number> = (node, object, { get }) => {
  return get(object, node.field) % node.value[0] === node.value[1];
};

export const $size: JsOperator<Field<number>, AnyObject | unknown[]> = (node, object, { get }) => {
  return get(object, node.field).length === node.value;
};

export const $regex: JsOperator<Field<RegExp>, AnyObject | string> = (node, object, { get }) => {
  return node.value.test(get(object, node.field));
};

export const $in: JsOperator<Field<unknown[]>> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value)) {
    return node.value.some(item => includes(value, item, equal));
  }

  return includes(node.value, value, equal);
};

export const $nin: typeof $in = (node, object, context) => {
  return !$in(node, object, context);
};

export const $all: JsOperator<Field<unknown[]>> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value)) {
    return node.value.every(v => includes(value, v, equal));
  }

  return false;
};

export const $elemMatch: JsOperator<Field<Condition>> = (node, object, { interpret, get }) => {
  const value = get(object, node.field);

  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(v => interpret(node.value, v));
}

type WhereFunction = (this: AnyObject) => boolean;
export const $where: JsOperator<Document<WhereFunction>, AnyObject> = (node, object) => {
  return node.value.call(object);
};
