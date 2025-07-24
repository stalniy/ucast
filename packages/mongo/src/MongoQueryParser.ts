import { Condition,
  buildAnd as and,
  ParsingInstruction,
  ObjectQueryParser,
  FieldQueryOperators,
  ParseOptions } from '@ucast/core';

import { MongoQuery } from './types';

export type MongoParseOptions = ParseOptions & {
  field?: string
};

export class MongoQueryParser extends ObjectQueryParser<MongoQuery<any>> {
  constructor(instructions: Record<string, ParsingInstruction>) {
    super(instructions, {
      defaultOperatorName: '$eq',
      operatorToConditionName: name => name.slice(1),
    });
  }

  parse<Q extends MongoQuery<any>, FQ extends FieldQueryOperators<Q> = FieldQueryOperators<Q>>(
    query: Q | FQ,
    options: MongoParseOptions = {}
  ): Condition {
    if (options.field) {
      return and(this.parseFieldOperators(options.field, query as FQ));
    }

    return super.parse(query, options);
  }
}
