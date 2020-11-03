import {
  Condition,
  buildAnd as and,
  ParsingInstruction,
  ObjectQueryParser,
  FieldQueryOperators,
} from '@ucast/core';
import { MongoQuery } from './types';

export interface ParseOptions {
  field: string
}

export class MongoQueryParser extends ObjectQueryParser<MongoQuery<any>> {
  constructor(instructions: Record<string, ParsingInstruction>) {
    super(instructions, {
      defaultOperatorName: '$eq',
      operatorToConditionName: name => name.slice(1),
    });
  }

  parse<Q extends MongoQuery<any>, FQ extends FieldQueryOperators<Q> = FieldQueryOperators<Q>>(
    query: Q | FQ,
    options?: ParseOptions
  ): Condition {
    if (options && options.field) {
      return and(this.parseFieldOperators(options.field, query as FQ));
    }

    return super.parse(query);
  }
}
