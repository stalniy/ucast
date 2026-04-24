import {
  CompoundCondition as Compound,
  FieldCondition as Field,
  DocumentCondition as Document,
  Condition,
  Comparable,
  ITSELF,
} from '@ucast/core';
import { JsInterpreter as Interpret } from './types';
import {
  includes,
  testValueOrArray,
  isArrayAndNotNumericField,
  AnyObject,
  hasOwn,
  matches,
  testRegExp,
} from './utils';
import { getObjectFieldCursor } from './interpreter';

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

export const eq: Interpret<Field> = (node, object, { compare, get }) => {
  const [item, field] = getObjectFieldCursor<Record<string, unknown>>(object, node.field, get);

  if (node.value === null) {
    const test = (candidate: unknown) => {
      if (candidate == null || typeof candidate !== 'object') {
        return true;
      }

      if (!hasOwn(candidate, field)) {
        return true;
      }

      const fieldValue = get(candidate, field);
      return fieldValue === null || (
        Array.isArray(fieldValue) && includes(fieldValue, null, compare)
      );
    };

    return isArrayAndNotNumericField(item, field) ? item.some(test) : test(item);
  }

  const value = get(item, field);

  if (Array.isArray(value)) {
    return compare(value, node.value) === 0 || includes(value, node.value, compare);
  }

  return matches(value, node.value, compare);
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

  const [item, field] = getObjectFieldCursor<{}>(object, node.field, get);
  const test = (value: {}) => {
    if (value == null) return node.value === false;
    return hasOwn(value, field) === node.value;
  };

  return isArrayAndNotNumericField(item, field) ? item.some(test) : test(item);
};

export const mod = testValueOrArray<[number, number], number>((node, value) => {
  return typeof value === 'number' && value % node.value[0] === node.value[1];
});

export const size: Interpret<Field<number>, AnyObject | unknown[]> = (node, object, { get }) => {
  const [items, field] = getObjectFieldCursor(object as AnyObject, node.field, get);
  const test = (item: unknown) => {
    const value = get(item, field);
    return Array.isArray(value) && value.length === node.value;
  };

  return node.field !== ITSELF && isArrayAndNotNumericField(items, field)
    ? items.some(test)
    : test(items);
};

export const regex = testValueOrArray<RegExp, string>((node, value) => {
  return testRegExp(node.value, value);
});

export const within = testValueOrArray<unknown[], unknown>((node, object, { compare }) => {
  return includes(node.value, object, compare);
});

export const nin: typeof within = (node, object, context) => !within(node, object, context);

export const all: Interpret<Field<unknown[]>> = (node, object, { compare, get }) => {
  const value = get(object, node.field);
  return Array.isArray(value) && node.value.every(v => includes(value, v, compare));
};

export const elemMatch: Interpret<Field<Condition>> = (node, object, { interpret, get }) => {
  const value = get(object, node.field);
  return Array.isArray(value) && value.some(v => interpret(node.value, v));
};

type WhereFunction = (this: AnyObject) => boolean;
export const where: Interpret<Document<WhereFunction>, AnyObject> = (node, object) => {
  return node.value.call(object);
};
