import {
  CompoundCondition as Compound,
  FieldCondition as Field,
  DocumentCondition as Document,
  Condition,
  Comparable,
  ITSELF,
} from '@ucast/core';
import { JsInterpreter as Interpret } from './types';
import { includes, AnyObject, testValueOrArray } from './utils';

export const or: Interpret<Compound> = (node, object, { interpret }) => {
  return node.value.some(condition => interpret(condition, object));
};

export const nor: typeof or = (node, object, context) => {
  return !or(node, object, context);
};

export const and: Interpret<Compound> = (node, object, { interpret }) => {
  return node.value.every(condition => interpret(condition, object));
};

export const not: Interpret<Compound> = (node, object, { interpret }) => {
  return !interpret(node.value[0], object);
};

export const eq: Interpret<Field> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value) && !Array.isArray(node.value)) {
    return includes(value, node.value, equal);
  }

  return equal(value, node.value);
};

export const ne: typeof eq = (node, object, context) => {
  return !eq(node, object, context);
};

export const lte = testValueOrArray<Comparable>((node, value, context) => {
  const result = context.compare(value, node.value);
  return result === 0 || result === -1;
});

export const lt = testValueOrArray<Comparable>((node, value, context) => {
  return context.compare(value, node.value) === -1;
});
export const gt = testValueOrArray<Comparable>((node, value, context) => {
  return context.compare(value, node.value) === 1;
});
export const gte = testValueOrArray<Comparable>((node, value, context) => {
  const result = context.compare(value, node.value);
  return result === 0 || result === 1;
});

export const exists: Interpret<Field<boolean>> = (node, object, { get }) => {
  if (node.field === ITSELF) {
    return typeof object !== 'undefined';
  }

  let item = object;
  let field = node.field;
  const dotIndex = node.field.lastIndexOf('.');
  const test = (value: {}) => !!value && value.hasOwnProperty(field) === node.value;

  if (dotIndex !== -1) {
    field = node.field.slice(dotIndex + 1);
    item = get(object, node.field.slice(0, dotIndex));
  }

  if (!Array.isArray(item)) {
    return !!item && item.hasOwnProperty(field) === node.value;
  }

  return Array.isArray(item) ? item.some(test) : test(item);
};

export const mod = testValueOrArray<[number, number], number>((node, value) => {
  return value % node.value[0] === node.value[1];
});

export const size: Interpret<Field<number>, AnyObject | unknown[]> = (node, object, { get }) => {
  const value = get(object, node.field);

  if (!Array.isArray(value)) {
    return false;
  }

  return value.hasOwnProperty('projected')
    ? value.some(v => Array.isArray(v) && v.length === node.value)
    : value.length === node.value;
};

export const regex = testValueOrArray<RegExp, string>((node, value) => node.value.test(value));

export const within: Interpret<Field<unknown[]>> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value)) {
    return node.value.some(item => includes(value, item, equal));
  }

  return includes(node.value, value, equal);
};

export const nin: typeof within = (node, object, context) => {
  return !within(node, object, context);
};

export const all: Interpret<Field<unknown[]>> = (node, object, { equal, get }) => {
  const value = get(object, node.field);

  if (Array.isArray(value)) {
    return node.value.every(v => includes(value, v, equal));
  }

  return false;
};

export const elemMatch: Interpret<Field<Condition>> = (node, object, { interpret, get }) => {
  const value = get(object, node.field);

  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(v => interpret(node.value, v));
};

type WhereFunction = (this: AnyObject) => boolean;
export const where: Interpret<Document<WhereFunction>, AnyObject> = (node, object) => {
  return node.value.call(object);
};
