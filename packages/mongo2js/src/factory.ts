import { createTranslatorFactory, ParsingInstruction, Condition, ITSELF } from '@ucast/core';
import {
  MongoQuery,
  MongoQueryParser,
  MongoQueryFieldOperators,
  allParsingInstructions
} from '@ucast/mongo';
import {
  createJsInterpreter,
  allInterpreters,
  JsInterpreter,
  JsInterpretationOptions,
  compare
} from '@ucast/js';

type ThingFilter<T> = {
  (object: T): boolean
  ast: Condition
};

interface HasToJSON {
  toJSON(): unknown
}

function toPrimitive(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (value && typeof (value as HasToJSON).toJSON === 'function') {
    return (value as HasToJSON).toJSON();
  }

  return value;
}

const comparePrimitives: typeof compare = (a, b) => compare(toPrimitive(a), toPrimitive(b));

export interface FactoryOptions extends JsInterpretationOptions {
  forPrimitives: boolean
}

export type Filter = <
  T = Record<string, unknown>,
  Q extends MongoQuery<T> = MongoQuery<T>
>(query: Q) => ThingFilter<T>;
export type PrimitiveFilter = <
  T,
  Q extends MongoQueryFieldOperators<T> = MongoQueryFieldOperators<T>
>(query: Q) => ThingFilter<T>;

type FilterType<T extends { forPrimitives?: true }> = T['forPrimitives'] extends true
  ? PrimitiveFilter
  : Filter;

export function createFactory<
  T extends Record<string, ParsingInstruction<any, any>>,
  I extends Record<string, JsInterpreter<any>>,
  P extends { forPrimitives?: true }
>(instructions: T, interpreters: I, options?: Partial<FactoryOptions> & P): FilterType<P> {
  const parser = new MongoQueryParser(instructions);
  const interpret = createJsInterpreter(interpreters, {
    compare: comparePrimitives,
    ...options
  });

  if (options && options.forPrimitives) {
    const params = { field: ITSELF };
    const parse: typeof parser.parse = query => parser.parse(query, params);
    return createTranslatorFactory(parse, interpret) as any;
  }

  return createTranslatorFactory(parser.parse, interpret) as any;
}

export const guard = createFactory(allParsingInstructions, allInterpreters);
export const squire = createFactory(allParsingInstructions, allInterpreters, {
  forPrimitives: true
});
export const filter = guard; // TODO: remove in next major version
