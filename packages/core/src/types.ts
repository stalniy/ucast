import { Condition } from './Condition';

export type Named<T, Name extends string = string> = T & { name: Name };

export type Parse<T = any> = (query: T, ...args: any[]) => Condition;

export interface OperatorInstruction<T = unknown, ParsingContext extends {} = {}> {
  type: string
  validate?(instruction: Named<this>, value: T): void
  parse?(instruction: Named<this>, value: T, context: ParsingContext & { parse: Parse<any> }): Condition
}

export interface CompoundOperatorInstruction<T = unknown, C extends {} = {}> extends OperatorInstruction<T, C> {
  type: 'compound',
}

export interface FieldParsingContext {
  field: string
}

export interface FieldOperatorInstruction<T = unknown, C extends FieldParsingContext = FieldParsingContext> extends OperatorInstruction<T, C> {
  type: 'field',
}

export type NamedOperatorInstruction<T extends string = string> = Named<OperatorInstruction, T>;
export type Comparable = number | string | Date;
