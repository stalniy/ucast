import {
  Condition,
  NamedInstruction,
  ParsingInstruction,
  FieldParsingContext,
  ParsingContext,
  NULL_CONDITION,
  buildAnd as and,
} from '@ucast/core';
import { MongoQuery, MongoQueryFieldOperators } from './types';
import { hasOperators } from './utils';
import { parseInstruction } from './defaultParsers';

type FieldOperatorName = keyof MongoQueryFieldOperators;
type ParsingInstructions = Record<string, NamedInstruction>;

export interface ParseOptions {
  field: string
}

export class MongoQueryParser {
  private readonly _instructions: ParsingInstructions;
  private _fieldInstructionContext: ParsingContext<FieldParsingContext & { query: unknown }>;

  constructor(instructions: Record<string, ParsingInstruction>) {
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { ...instructions[name], name: name.slice(1) };
      return all;
    }, {} as ParsingInstructions);
    this.parse = this.parse.bind(this);
    this._fieldInstructionContext = { field: '', query: {}, parse: this.parse };
  }

  private _parseField(field: string, operator: string, value: unknown, parentQuery: unknown) {
    const instruction = this._instructions[operator];

    if (!instruction) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    if (instruction.type !== 'field') {
      throw new Error(`Unexpected ${instruction.type} operator "${operator}" at field level`);
    }

    this._fieldInstructionContext.field = field;
    this._fieldInstructionContext.query = parentQuery;

    return parseInstruction(instruction, value, this._fieldInstructionContext);
  }

  private _parseFieldOperators(field: string, value: MongoQueryFieldOperators) {
    const conditions: Condition[] = [];
    const keys = Object.keys(value);

    for (let i = 0, length = keys.length; i < length; i++) {
      const op = keys[i];

      if (op[0] !== '$') {
        throw new Error(`Field query for "${field}" may contain only operators or a plain object as a value`);
      }

      const condition = this._parseField(field, op, value[op as FieldOperatorName], value);

      if (condition !== NULL_CONDITION) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  parse<T extends MongoQuery<any>>(rawQuery: T, options?: ParseOptions): Condition {
    if (options && options.field) {
      return and(this._parseFieldOperators(options.field, rawQuery as MongoQueryFieldOperators));
    }

    const query = rawQuery as MongoQuery;
    const defaultContext = { query, parse: this.parse };
    const conditions = [];
    const keys = Object.keys(query);

    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      const value = query[key];
      const isOperator = key[0] === '$';
      const instruction = this._instructions[key];

      if (isOperator) {
        if (!instruction) {
          throw new Error(`Unsupported operator "${key}"`);
        }

        if (instruction.type !== 'document' && instruction.type !== 'compound') {
          throw new Error(`Unknown top level operator "${key}"`);
        }

        conditions.push(parseInstruction(instruction, value, defaultContext));
      } else if (hasOperators(value)) {
        conditions.push(...this._parseFieldOperators(key, value));
      } else {
        conditions.push(this._parseField(key, '$eq', value, query));
      }
    }

    return and(conditions);
  }
}
