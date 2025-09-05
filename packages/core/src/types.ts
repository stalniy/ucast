import { Condition } from './Condition';

export type Named<T, Name extends string = string> = T & { name: Name };
export type Parse<T = any> = (query: T, ...args: any[]) => Condition;
export type ParsingContext<T extends {}> = T & { parse: Parse };

export interface ParsingInstruction<T = unknown, Context extends {} = {}> {
  type: string
  validate?(instruction: Named<this>, value: T): void
  parse?(instruction: Named<this>, value: T, context: ParsingContext<Context>): Condition
}

export interface CompoundInstruction<
  T = unknown,
  C extends {} = {}
> extends ParsingInstruction<T, C> {
  type: 'compound',
}

export interface DocumentInstruction<
  T = unknown,
  C extends {} = {}
> extends ParsingInstruction<T, C> {
  type: 'document',
}

export interface FieldParsingContext {
  field: string
}

export interface FieldInstruction<
  T = unknown,
  C extends FieldParsingContext = FieldParsingContext
> extends ParsingInstruction<T, C> {
  type: 'field',
}

export type NamedInstruction<T extends string = string> = Named<ParsingInstruction, T>;
export type Comparable = number | string | Date;

export type PrevIndex = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

type IsRecursiveKeyValue<T> = T extends Date ?
  never :
  T extends Record<PropertyKey, any> ?
    T :
    never;

export type NestedKeys<
    T extends Record<PropertyKey, any>,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
  {
    [Key in keyof T & string]: T[Key] extends Array<infer ELEMENT> ?
      (
        ELEMENT extends IsRecursiveKeyValue<ELEMENT> ?
                `${Key}.${NestedKeys<ELEMENT, PrevIndex[DEPTH]>}` :
                `${Key}`
      ) :
      T[Key] extends IsRecursiveKeyValue<T[Key]> ?
            `${Key}.${NestedKeys<T[Key], PrevIndex[DEPTH]>}` :
            `${Key}`
  }[keyof T & string];

export type TypeFromNestedKeyPath<
    T extends Record<PropertyKey, any>,
    Path extends string,
    DEPTH extends number = 4,
> = [DEPTH] extends [0] ? never :
  {
    [Key in Path & string]: Key extends keyof T
      ? (
        T[Key] extends Array<infer ELEMENT> ?
          ELEMENT :
          T[Key]
      )
      : Key extends `${infer P}.${infer S}` ?
        (P extends keyof T ?
          (
            T[P] extends Array<infer ELEMENT> ?
              (
                ELEMENT extends Record<PropertyKey, any> ?
                  TypeFromNestedKeyPath<ELEMENT, S, PrevIndex[DEPTH]> :
                  never
              ) :
              T[P] extends Record<PropertyKey, any>
                ? TypeFromNestedKeyPath<T[P], S, PrevIndex[DEPTH]>
                : never
          )
          : never
        ) :
        never;
  }[Path];
