import { createInterpreter, ITSELF } from '@ucast/core';
import { getValueByPath, AnyObject, GetField } from './utils';
import { IsArray, JsInterpretationOptions, JsInterpreter } from './types';

const defaultGet = (object: AnyObject, field: string) => object[field];
const defaultIsArray: IsArray = Array.isArray;
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

export function getObjectField(
  object: unknown,
  field: Field,
  get: GetField = defaultGet,
  isArray: IsArray = defaultIsArray
) {
  if (field === ITSELF) {
    return object;
  }

  if (!object) {
    throw new Error(`Unable to get field "${field}" out of ${String(object)}.`);
  }

  return getValueByPath(object as Record<string, unknown>, field, get, isArray);
}

export function createGetter<T extends GetField>(
  get: T,
  isArray: IsArray = defaultIsArray
) {
  return (object: Parameters<T>[0], field: Parameters<T>[1]) => {
    return getObjectField(object, field, get, isArray);
  };
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
  const isArray = options.isArray || defaultIsArray;
  const get = (object: unknown, field: Field) => {
    return getObjectField(object, field, options.get as GetField || defaultGet, isArray);
  };

  return createInterpreter(operators, {
    get,
    compare: options.compare || compare,
    isArray,
  });
}
