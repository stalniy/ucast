import { createTranslatorFactory, ParsingInstruction, Condition } from '@ucast/core';
import { MongoQuery, MongoQueryParser, allParsingInstructions } from '@ucast/mongo';
import { createJsInterpreter, allInterpreters, JsInterpreter, JsInterpretationOptions } from '@ucast/js';

type Filter = <T = Record<string, unknown>, Q extends MongoQuery<T> = MongoQuery<T>>(query: Q) => {
  (object: T): boolean
  ast: Condition
};

export function createFactory<
  T extends Record<string, ParsingInstruction<any, any>>,
  I extends Record<string, JsInterpreter<any>>
>(instructions: T, interpreters: I, options?: Partial<JsInterpretationOptions>) {
  return createTranslatorFactory(
    new MongoQueryParser(instructions).parse,
    createJsInterpreter(interpreters, options)
  ) as unknown as Filter;
}

export const filter = createFactory(allParsingInstructions, allInterpreters);
