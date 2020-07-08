import { Condition, createInterpreter, ITSELF, InterpretationContext } from '@ucast/core';
import { getValueByPath, AnyObject, GetField } from './utils';
import { JsInterpretationOptions } from './types';

const defaultGet = (object: AnyObject, field: string) => object[field];
type Field = string | typeof ITSELF;

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

export const equal = <T>(a: T, b: T) => a === b;

export type JsInterpreter<N extends Condition, Value = any> = (
  node: N,
  value: Value,
  context: InterpretationContext<JsInterpreter<N, Value>> & JsInterpretationOptions
) => boolean;

export function createJsInterpreter<
  T extends JsInterpreter<any>,
  O extends Partial<JsInterpretationOptions>
>(
  operators: Record<string, T>,
  options: O = {} as O
) {
  return createInterpreter(operators, {
    ...options,
    get: options.get || getObjectField,
    equal: options.equal || equal,
  });
}
