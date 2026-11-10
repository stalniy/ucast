import { FieldCondition, ITSELF } from '@ucast/core';
import { IsArray, JsInterpretationOptions, JsInterpreter } from './types';

export type AnyObject = Record<PropertyKey, unknown>;
export type GetField = (object: any, field: string) => any;

const REGEXP_ESCAPE_SEQ = /[.*+?^${}()|[\]\\]/g
export function likePatternToRegexp(pattern: string, flags: '' | 'i' = ''): RegExp {
  if (typeof pattern !== 'string') {
    throw new TypeError('LIKE pattern must be a string');
  }

  let source = '';
  let escaped = false;

  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i];
    if (!escaped && character === '\\') {
      escaped = true;
      continue;
    }

    if (!escaped && character === '%') {
      source += '[\\s\\S]*';
    } else if (!escaped && character === '_') {
      source += '[\\s\\S]';
    } else {
      source += character.replace(REGEXP_ESCAPE_SEQ, '\\$&');
    }

    escaped = false;
  }

  if (escaped) {
    throw new SyntaxError('LIKE pattern must not end with an escape character');
  }

  return new RegExp(`^${source}$`, `u${flags}`);
}

export function testRegExp(regex: RegExp, value: unknown): boolean {
  if (typeof value !== 'string') return false;

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
    if (object[i] == null) continue;

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

export const arraySome = Array.prototype.some;
export function testValueOrArray<T, U = T>(test: JsInterpreter<FieldCondition<T>, U>) {
  return ((node, object, context) => {
    const value = context.get(object, node.field);

    if (!context.isArray(value)) {
      return test(node, value, context);
    }

    return arraySome.call(value, (v: U) => test(node, v, context));
  }) as JsInterpreter<FieldCondition<T>, AnyObject | U>;
}

export const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));
