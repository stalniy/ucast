import { FieldCondition, ITSELF } from '@ucast/core';
import { IsArray, JsInterpretationOptions, JsInterpreter } from './types';

export type AnyObject = Record<PropertyKey, unknown>;
export type GetField = (object: any, field: string) => any;

export function testRegExp(regex: RegExp, value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  regex.lastIndex = 0;
  const result = regex.test(value);
  regex.lastIndex = 0;

  return result;
}

export function getFieldValue(
  object: unknown,
  field: string | typeof ITSELF,
  get: GetField
) {
  if (field !== ITSELF && (object == null || typeof object !== 'object')) {
    return undefined;
  }

  return get(object, field);
}

export function matches(
  a: unknown,
  b: unknown,
  compare: JsInterpretationOptions['compare']
): boolean {
  if (a instanceof RegExp) {
    return testRegExp(a, b);
  }

  if (b instanceof RegExp) {
    return testRegExp(b, a);
  }

  return compare(a, b) === 0;
}

export function includes(
  items: unknown[],
  value: unknown,
  compare: JsInterpretationOptions['compare']
): boolean {
  for (let i = 0, length = items.length; i < length; i++) {
    if (matches(items[i], value, compare)) {
      return true;
    }
  }

  return false;
}

export function isArrayAndNotNumericField<T>(
  object: T | T[],
  field: string,
  isArray: IsArray
): object is T[] {
  return isArray(object) && Number.isNaN(Number(field));
}

function getField<T extends AnyObject>(
  object: T | T[],
  field: string,
  get: GetField,
  isArray: IsArray
) {
  if (!isArrayAndNotNumericField(object, field, isArray)) {
    return get(object, field);
  }

  let result: unknown[] = [];

  for (let i = 0; i < object.length; i++) {
    const value = get(object[i], field);
    if (typeof value !== 'undefined') {
      result = result.concat(value);
    }
  }

  return result;
}

export function getValueByPath(
  object: AnyObject,
  field: string,
  get: GetField,
  isArray: IsArray
) {
  if (field.indexOf('.') === -1) {
    return getField(object, field, get, isArray);
  }

  const paths = field.split('.');
  let value = object;

  for (let i = 0, length = paths.length; i < length; i++) {
    value = getField(value, paths[i], get, isArray);

    if (!value || typeof value !== 'object') {
      return i < length - 1 ? undefined : value;
    }
  }

  return value;
}

export function testValueOrArray<T, U = T>(test: JsInterpreter<FieldCondition<T>, U>) {
  return ((node, object, context) => {
    const value = context.get(object, node.field);

    if (!context.isArray(value)) {
      return test(node, value, context);
    }

    return (value as U[]).some(v => test(node, v, context));
  }) as JsInterpreter<FieldCondition<T>, AnyObject | U>;
}

export const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));
