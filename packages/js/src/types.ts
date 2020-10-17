import { Condition, ITSELF, InterpretationContext } from '@ucast/core';

export interface JsInterpretationOptions {
  get(object: any, field: string | typeof ITSELF): any
  compare<T>(a: T, b: T): 1 | -1 | 0
}

export type JsInterpreter<N extends Condition, Value = any> = (
  node: N,
  value: Value,
  context: InterpretationContext<JsInterpreter<N, Value>> & JsInterpretationOptions
) => boolean;
