import { createInterpreter, ITSELF } from '@ucast/core';
import { getValueByPath, AnyObject, GetField } from './utils';
import { JsInterpretationOptions, JsInterpreter } from './types';

const defaultGet = (object: AnyObject, field: string) => object[field];
type Field = string | typeof ITSELF;

export function getObjectFieldCursor<T extends {}>(object: T, path: string, get: GetField) {
  const dotIndex = path.lastIndexOf('.');

  if (dotIndex === -1) {
    return [object, path] as const;
  }

  return [
    get(object, path.slice(0, dotIndex)) as T,
    path.slice(dotIndex + 1)
  ] as const;
}

export function getObjectField(object: unknown, field: Field, get: GetField = defaultGet) {
  if (field === ITSELF) {
    return object;
  }

  if (!object) {
    throw new Error(`Unable to get field "${field}" out of ${String(object)}.`);
  }

  return getValueByPath(object as Record<string, unknown>, field, get);
}

export function createGetter<T extends GetField>(get: T) {
  return (object: Parameters<T>[0], field: Parameters<T>[1]) => getObjectField(object, field, get);
}

export function compare<T>(a: T, b: T): 0 | 1 | -1 {
  if (a === b) {
    return 0;
  }

  return a > b ? 1 : -1;
}

export function createJsInterpreter<
  T extends JsInterpreter<any>,
  O extends Partial<JsInterpretationOptions>
>(
  operators: Record<string, T>,
  options: O = {} as O
) {
  return createInterpreter(operators, {
    get: getObjectField,
    compare,
    ...options,
  });
}
