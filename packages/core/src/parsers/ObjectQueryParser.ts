import { Condition, NULL_CONDITION } from '../Condition';
import {
  NamedInstruction,
  ParsingInstruction,
  FieldParsingContext,
  ParsingContext,
} from '../types';
import { buildAnd as and } from '../builder';
import { parseInstruction } from './defaultInstructionParsers';
import { identity, hasOperators } from '../utils';

export type FieldQueryOperators<T extends {}> = {
  [K in keyof T]: T[K] extends {} ? T[K] : never
}[keyof T];

type ParsingInstructions = Record<string, NamedInstruction>;

export interface QueryOptions {
  operatorToConditionName?(name: string): string
  defaultOperatorName?: string
}

export type ObjectQueryFieldParsingContext = ParsingContext<FieldParsingContext & {
  query: unknown,
  hasOperators<T>(value: unknown): value is T
}>;

export class ObjectQueryParser<
  T extends Record<any, any>,
  U extends FieldQueryOperators<T> = FieldQueryOperators<T>
> {
  protected readonly _instructions: ParsingInstructions;
  protected _fieldInstructionContext: ObjectQueryFieldParsingContext;
  protected readonly _options: Required<QueryOptions>;

  constructor(instructions: Record<string, ParsingInstruction>, options?: QueryOptions) {
    this.parse = this.parse.bind(this);
    this._options = {
      operatorToConditionName: identity,
      defaultOperatorName: 'eq',
      ...options
    };
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { name: this._options.operatorToConditionName(name), ...instructions[name] };
      return all;
    }, {} as ParsingInstructions);
    this._fieldInstructionContext = {
      field: '',
      query: {},
      parse: this.parse,
      hasOperators: <T>(value: unknown): value is T => hasOperators(value, this._instructions),
    };
  }

  setParse(parse: this['parse']) {
    this.parse = parse;
    this._fieldInstructionContext.parse = parse;
  }

  protected _parseField(field: string, operator: string, value: unknown, parentQuery: unknown) {
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

  protected _parseFieldOperators(field: string, value: U) {
    const conditions: Condition[] = [];
    const keys = Object.keys(value);

    for (let i = 0, length = keys.length; i < length; i++) {
      const op = keys[i];
      const instruction = this._instructions[op];

      if (!instruction) {
        throw new Error(`Field query for "${field}" may contain only operators or a plain object as a value`);
      }

      const condition = this._parseField(field, op, value[op as keyof U], value);

      if (condition !== NULL_CONDITION) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  parse<Q extends T, FQ extends U = U>(query: Q): Condition {
    const defaultContext = { query, parse: this.parse };
    const conditions = [];
    const keys = Object.keys(query);

    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      const value = query[key];
      const instruction = this._instructions[key];

      if (instruction) {
        if (instruction.type !== 'document' && instruction.type !== 'compound') {
          throw new Error(`Cannot use parsing instruction for operator "${key}" in "document" context as it is supposed to be used in  "${instruction.type}" context`);
        }

        conditions.push(parseInstruction(instruction, value, defaultContext));
      } else if (hasOperators<FQ>(value, this._instructions)) {
        conditions.push(...this._parseFieldOperators(key, value));
      } else {
        conditions.push(this._parseField(key, this._options.defaultOperatorName, value, query));
      }
    }

    return and(conditions);
  }
}
