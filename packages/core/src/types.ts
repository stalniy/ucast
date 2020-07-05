import { Condition } from './Condition';

export type Named<T, Name extends string = string> = T & { name: Name };

export type Parse<T = any> = (query: T, ...args: any[]) => Condition;

export interface ParsingInstruction<T = unknown, ParsingContext extends {} = {}> {
  type: string
  validate?(instruction: Named<this>, value: T): void
  parse?(instruction: Named<this>, value: T, context: ParsingContext & { parse: Parse<any> }): Condition
}

export interface CompoundInstruction<T = unknown, C extends {} = {}> extends ParsingInstruction<T, C> {
  type: 'compound',
}

export interface ValueInstruction<T = unknown, C extends {} = {}> extends ParsingInstruction<T, C> {
  type: 'value',
}

export interface FieldParsingContext {
  field: string
}

export interface FieldInstruction<T = unknown, C extends FieldParsingContext = FieldParsingContext> extends ParsingInstruction<T, C> {
  type: 'field',
}

export type NamedInstruction<T extends string = string> = Named<ParsingInstruction, T>;
export type Comparable = number | string | Date;
