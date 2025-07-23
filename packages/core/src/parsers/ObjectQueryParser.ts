import { Condition } from '../Condition';
import {
  NamedInstruction,
  ParsingInstruction,
  FieldParsingContext,
  ParsingContext,
} from '../types';
import { buildAnd } from '../builder';
import { defaultInstructionParsers } from './defaultInstructionParsers';
import {
  identity,
  hasOperators,
  object,
  pushIfNonNullCondition,
  objectKeysSkipIgnore, isObject, ignoreValue,
} from '../utils';

export type FieldQueryOperators<T extends {}> = {
  [K in keyof T]: T[K] extends {} ? T[K] : never
}[keyof T];

type ParsingInstructions = Record<string, NamedInstruction>;

export interface QueryOptions {
  operatorToConditionName?(name: string): string
  defaultOperatorName?: string
  fieldContext?: Record<string, unknown>
  documentContext?: Record<string, unknown>
  useIgnoreValue?: boolean
  mergeFinalConditions?(conditions: Condition[]): Condition
}

export type ObjectQueryFieldParsingContext = ParsingContext<FieldParsingContext & {
  query: {},
  hasOperators<T>(value: unknown): value is T
}>;

type ParseOptions = {
  parent?: string
};

export class ObjectQueryParser<
  T extends Record<any, any>,
  U extends FieldQueryOperators<T> = FieldQueryOperators<T>
> {
  private readonly _instructions: ParsingInstructions;
  private _fieldInstructionContext: ObjectQueryFieldParsingContext;
  private _documentInstructionContext: ParsingContext<{ query: {} }>;
  private readonly _options: Required<
  Pick<QueryOptions,
  'operatorToConditionName' |
  'defaultOperatorName' |
  'mergeFinalConditions' |
  'useIgnoreValue'
  >
  >;

  private readonly _objectKeys: typeof Object.keys;

  constructor(instructions: Record<string, ParsingInstruction>, options: QueryOptions = object()) {
    this.parse = this.parse.bind(this);
    this._options = {
      operatorToConditionName: options.operatorToConditionName || identity,
      defaultOperatorName: options.defaultOperatorName || 'eq',
      mergeFinalConditions: options.mergeFinalConditions || buildAnd,
      useIgnoreValue: options.useIgnoreValue ?? false
    };
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { name: this._options.operatorToConditionName(name), ...instructions[name] };
      return all;
    }, {} as ParsingInstructions);
    this._fieldInstructionContext = {
      ...options.fieldContext,
      field: '',
      query: {},
      parse: this.parse,
      hasOperators: <T>(value: unknown): value is T => hasOperators(
        value,
        this._instructions,
        options.useIgnoreValue
      ),
    };
    this._documentInstructionContext = {
      ...options.documentContext,
      parse: this.parse,
      query: {}
    };
    this._objectKeys = options.useIgnoreValue ? objectKeysSkipIgnore : Object.keys;
  }

  setParse(parse: this['parse']) {
    this.parse = parse;
    this._fieldInstructionContext.parse = parse;
    this._documentInstructionContext.parse = parse;
  }

  protected parseField(field: string, operator: string, value: unknown, parentQuery: {}) {
    const instruction = this._instructions[operator];

    if (!instruction) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    if (instruction.type !== 'field') {
      throw new Error(`Unexpected ${instruction.type} operator "${operator}" at field level`);
    }

    this._fieldInstructionContext.field = field;
    this._fieldInstructionContext.query = parentQuery;

    return this.parseInstruction(instruction, value, this._fieldInstructionContext);
  }

  // eslint-disable-next-line class-methods-use-this
  protected parseInstruction(
    instruction: NamedInstruction,
    value: unknown,
    context: ParsingContext<{}>
  ) {
    if (typeof instruction.validate === 'function') {
      instruction.validate(instruction, value);
    }

    const parse: typeof instruction.parse = instruction.parse
      || defaultInstructionParsers[instruction.type as keyof typeof defaultInstructionParsers];
    return parse(instruction, value, context);
  }

  protected parseFieldOperators(field: string, value: U) {
    const conditions: Condition[] = [];
    const keys = this._objectKeys(value);

    for (let i = 0, length = keys.length; i < length; i++) {
      const op = keys[i];
      const instruction = this._instructions[op];

      if (!instruction) {
        throw new Error(`Field query for "${field}" may contain only operators or a plain object as a value`);
      }

      const condition = this.parseField(field, op, value[op as keyof U], value);
      pushIfNonNullCondition(conditions, condition);
    }

    return conditions;
  }

  parse<Q extends T>(query: Q, options: ParseOptions = {}): Condition {
    const conditions = [];
    const keys = Object.keys(query);

    this._documentInstructionContext.query = query;

    const nextKey = (key: string) => {
      if (options.parent) {
        return `${options.parent}.${key}`;
      }

      return key;
    };

    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      const value = query[key];

      const skip = this._options.useIgnoreValue
          && value === ignoreValue;

      if (skip) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const instruction = this._instructions[key];
      if (instruction && !options.parent) {
        if (instruction.type !== 'document' && instruction.type !== 'compound') {
          throw new Error(`Cannot use parsing instruction for operator "${key}" in "document" context as it is supposed to be used in  "${instruction.type}" context`);
        }

        pushIfNonNullCondition(
          conditions,
          this.parseInstruction(instruction, value, this._documentInstructionContext)
        );
      } else if (this._fieldInstructionContext.hasOperators<U>(value)) {
        conditions.push(...this.parseFieldOperators(nextKey(key), value));
      } else if (isObject(value)) {
        conditions.push(this.parse(
          value as T,
          {
            parent: nextKey(key)
          }
        ));
      } else {
        pushIfNonNullCondition(
          conditions,
          this.parseField(
            nextKey(key),
            this._options.defaultOperatorName,
            value,
            query
          )
        );
      }
    }

    return this._options.mergeFinalConditions(conditions);
  }
}
