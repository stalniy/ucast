import { FieldCondition } from '@ucast/core';
import { JsInterpretationOptions, JsInterpreter } from './types';

export type AnyObject = Record<PropertyKey, unknown>;
export type GetField = (object: any, field: string) => any;

export function includes<T>(items: T[], value: T, equal: JsInterpretationOptions['equal']): boolean {
  for (let i = 0, length = items.length; i < length; i++) {
    if (equal(items[i], value)) {
      return true;
    }
  }

  return false;
}

export const PROJECTED_FIELD = typeof Symbol === 'undefined' ? '__projected' : Symbol('projected');

export function isArrayAndNotNumericField<T>(object: T | T[], field: string): object is T[] {
  return Array.isArray(object) && Number.isNaN(Number(field));
}

function getField<T extends AnyObject>(object: T | T[], field: string, get: GetField) {
  if (isArrayAndNotNumericField(object, field)) {
    const items = object.map(item => get(item, field));
    return Object.defineProperty(items, PROJECTED_FIELD, { value: true });
  }

  return get(object, field);
}

export function getValueByPath(object: AnyObject, field: string, get: GetField) {
  if (field.indexOf('.') === -1) {
    return getField(object, field, get);
  }

  const paths = field.split('.');
  let value = object;

  for (let i = 0, length = paths.length; i < length; i++) {
    value = getField(value, paths[i], get);

    if (!value || typeof value !== 'object') {
      return value;
    }
  }

  return value;
}

export function testValueOrArray<T, U = T>(test: JsInterpreter<FieldCondition<T>, U>) {
  return ((node, object, context) => {
    const value = context.get(object, node.field);

    if (!Array.isArray(value)) {
      return test(node, value, context);
    }

    return value.some(v => test(node, v, context));
  }) as JsInterpreter<FieldCondition<T>, AnyObject | U>;
}
