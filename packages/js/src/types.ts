import { ITSELF } from '@ucast/core';

export interface JsInterpretationOptions {
  get(object: any, field: string | typeof ITSELF): any
  equal<T>(a: T, b: T): boolean
}
