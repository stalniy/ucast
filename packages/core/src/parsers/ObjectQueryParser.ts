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
  objectKeysSkipIgnore,
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
  /**
   * When `true`, the parser throws on field values that are plain objects
   * whose keys do NOT include any registered operator, instead of silently
   * falling back to treating the parent key as a field name with the
   * default operator.
   *
   * Without this flag, `{ status: { equals: 'x' } }` against a parser where
   * `equals` is not registered (e.g. Mongo, whose canonical operator is
   * `$eq`) compiles as `status defaultOp { equals: 'x' }` and never matches
   * at runtime. The fallback is convenient for legitimate field-name
   * shorthand (`{ name: 'alice' }`) but masks wrong-shape rules from
   * hand-rolled translators and dialect mix-ups.
   *
   * Field-name shorthand for primitive, array, and non-plain-object values
   * (e.g. Date) continues to work. Only the "object value with all-unknown
   * keys" shape is rejected.
   *
   * Defaults to `false` for backwards compatibility.
   */
  strictOperators?: boolean
}

export type ObjectQueryFieldParsingContext = ParsingContext<FieldParsingContext & {
  query: {},
  hasOperators<T>(value: unknown): value is T
}>;

export class ObjectQueryParser<
  T extends Record<any, any>,
  U extends FieldQueryOperators<T> = FieldQueryOperators<T>
> {
  private readonly _instructions: ParsingInstructions;
  private _fieldInstructionContext: ObjectQueryFieldParsingContext;
  private _documentInstructionContext: ParsingContext<{ query: {} }>;
  private readonly _options: Required<Pick<
  QueryOptions,
  'operatorToConditionName' | 'defaultOperatorName' | 'mergeFinalConditions' | 'strictOperators'
  >>;

  private readonly _objectKeys: typeof Object.keys;

  constructor(instructions: Record<string, ParsingInstruction>, options: QueryOptions = object()) {
    this.parse = this.parse.bind(this);
    this._options = {
      operatorToConditionName: options.operatorToConditionName || identity,
      defaultOperatorName: options.defaultOperatorName || 'eq',
      mergeFinalConditions: options.mergeFinalConditions || buildAnd,
      strictOperators: options.strictOperators === true,
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

  protected assertNoUnknownOperatorObject(field: string, value: unknown): void {
    if (!value || (value as { constructor?: unknown }).constructor !== Object) {
      return;
    }

    const keys = this._objectKeys(value as Record<string, unknown>);

    if (keys.length === 0) {
      return;
    }

    throw new Error(
      `Unrecognized operator key(s) in field query for "${field}": ${keys.join(', ')}`
    );
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

  parse<Q extends T>(query: Q): Condition {
    const conditions = [];
    const keys = this._objectKeys(query);

    this._documentInstructionContext.query = query;

    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      const value = query[key];
      const instruction = this._instructions[key];

      if (instruction) {
        if (instruction.type !== 'document' && instruction.type !== 'compound') {
          throw new Error(`Cannot use parsing instruction for operator "${key}" in "document" context as it is supposed to be used in  "${instruction.type}" context`);
        }

        pushIfNonNullCondition(
          conditions,
          this.parseInstruction(instruction, value, this._documentInstructionContext)
        );
      } else if (this._fieldInstructionContext.hasOperators<U>(value)) {
        conditions.push(...this.parseFieldOperators(key, value));
      } else {
        if (this._options.strictOperators) {
          this.assertNoUnknownOperatorObject(key, value);
        }
        pushIfNonNullCondition(
          conditions,
          this.parseField(key, this._options.defaultOperatorName, value, query)
        );
      }
    }

    return this._options.mergeFinalConditions(conditions);
  }
}
