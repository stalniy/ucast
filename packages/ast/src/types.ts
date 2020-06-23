import { Condition } from './Condition';

type Named<T> = T & { name: string };

interface BaseOperatorInstruction<T> {
  validate?(instruction: Named<this>, value: T): void
}

export type Parse = (query: any, ...args: any[]) => Condition

export interface CompoundOperatorInstruction<T = unknown, Q = unknown> extends BaseOperatorInstruction<T> {
  type: 'compound',
  parse?(parse: Parse, instruction: Named<this>, value: T, query: Q): Condition
}

export interface FieldOperatorInstruction<T = unknown, Q = unknown> extends BaseOperatorInstruction<T> {
  type: 'field',
  parse?(parse: Parse, instruction: Named<this>, field: string, value: T, query: Q): Condition
}

export type OperatorInstruction = FieldOperatorInstruction | CompoundOperatorInstruction;
export type NamedOperatorInstruction = Named<OperatorInstruction>;
