import { createTranslatorFactory, ParsingInstruction, Condition } from '@ucast/core';
import { MongoQuery, MongoQueryParser, allParsingInstructions } from '@ucast/mongo';
import {
  createJsInterpreter,
  allInterpreters,
  JsInterpreter,
  JsInterpretationOptions,
  compare
} from '@ucast/js';

type Filter = <T = Record<string, unknown>, Q extends MongoQuery<T> = MongoQuery<T>>(query: Q) => {
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

export function createFactory<
  T extends Record<string, ParsingInstruction<any, any>>,
  I extends Record<string, JsInterpreter<any>>
>(instructions: T, interpreters: I, options?: Partial<JsInterpretationOptions>) {
  return createTranslatorFactory(
    new MongoQueryParser(instructions).parse,
    createJsInterpreter(interpreters, {
      compare: comparePrimitives,
      ...options
    })
  ) as unknown as Filter;
}

export const filter = createFactory(allParsingInstructions, allInterpreters);
