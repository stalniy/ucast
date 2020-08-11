import { ITSELF } from '@ucast/core';

export interface JsInterpretationOptions {
  get(object: any, field: string | typeof ITSELF): any
  /** @deprecated use "compare" option instead */
  equal<T>(a: T, b: T): boolean
  compare<T>(a: T, b: T): 1 | -1 | 0
}
