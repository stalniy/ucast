import { createTranslatorFactory, ParsingInstruction, Condition, ITSELF } from '@ucast/core';
import {
  MongoQuery,
  MongoQueryParser,
  MongoQueryFieldOperators,
  allParsingInstructions,
  defaultParsers
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

export type PrimitiveMongoQuery<T> = MongoQueryFieldOperators<T> & Partial<{
  $and: MongoQueryFieldOperators<T>[],
  $or: MongoQueryFieldOperators<T>[],
  $nor: MongoQueryFieldOperators<T>[]
}>;
export type PrimitiveFilter = <
  T,
  Q extends PrimitiveMongoQuery<T> = PrimitiveMongoQuery<T>
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
    const parse = parser.parse;
    parser.setParse(query => parse(query, params));
  }

  return createTranslatorFactory(parser.parse, interpret) as any;
}

export const guard = createFactory(allParsingInstructions, allInterpreters);

const compoundOperators = ['$and', '$or'] as const;
const allPrimitiveParsingInstructions = compoundOperators.reduce((instructions, name) => {
  instructions[name] = { ...instructions[name], type: 'field' } as any;
  return instructions;
}, {
  ...allParsingInstructions,
  $nor: {
    ...allParsingInstructions.$nor,
    type: 'field',
    parse: defaultParsers.compound
  }
});

export const squire = createFactory(allPrimitiveParsingInstructions, allInterpreters, {
  forPrimitives: true
});
export const filter = guard; // TODO: remove in next major version
