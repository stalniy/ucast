import {
  Condition,
  FieldCondition,
  CompoundCondition,
  DocumentCondition,
  NamedInstruction,
  ParsingInstruction,
  DocumentInstruction,
  CompoundInstruction,
  FieldInstruction,
  FieldParsingContext,
  ParsingContext,
  NULL_CONDITION
} from '@ucast/core';
import { MongoQuery, MongoQueryFieldOperators } from './types';
import { isCompound, tryToSimplifyCompoundCondition, hasOperators } from './utils';

function and(...conditions: Condition[]) {
  return tryToSimplifyCompoundCondition('and', conditions);
}

interface DefaultParsers {
  compound: Exclude<CompoundInstruction<MongoQuery[]>['parse'], undefined>,
  field: Exclude<FieldInstruction['parse'], undefined>,
  document: Exclude<DocumentInstruction['parse'], undefined>
}

export const defaultParsers: DefaultParsers = {
  compound(instruction, value, context) {
    const queries = Array.isArray(value) ? value : [value];
    const conditions = queries.map(query => context.parse(query));
    return new CompoundCondition(instruction.name, conditions);
  },
  field(instruction, value, context) {
    return new FieldCondition(instruction.name, context.field, value);
  },
  document(instruction, value) {
    return new DocumentCondition(instruction.name, value);
  }
};

type FieldOperatorName = keyof MongoQueryFieldOperators;
type ParsingInstructions = Record<string, NamedInstruction>;

export interface ParseOptions {
  field: string
}

type FieldInstructionContext = ParsingContext<FieldParsingContext & { query: unknown }>;

export class MongoQueryParser {
  private readonly _instructions: ParsingInstructions;
  private _fieldInstructionContext: FieldInstructionContext;

  constructor(instructions: Record<string, ParsingInstruction>) {
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { ...instructions[name], name: name.slice(1) };
      return all;
    }, {} as ParsingInstructions);
    this.parse = this.parse.bind(this);
    this._fieldInstructionContext = { field: '', query: {}, parse: this.parse };
  }

  private _parseField(
    field: string,
    operator: string,
    value: unknown,
    parentQuery: unknown
  ): Condition {
    const instruction = this._instructions[operator];

    if (!instruction) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    if (instruction.type !== 'field') {
      throw new Error(`Unexpected ${instruction.type} operator "${operator}" at field level`);
    }

    if (instruction.validate) {
      instruction.validate(instruction, value);
    }

    const parse: Function = instruction.parse || defaultParsers.field;
    this._fieldInstructionContext.field = field;
    this._fieldInstructionContext.query = parentQuery;
    return parse(instruction, value, this._fieldInstructionContext);
  }

  private _parseFieldOperators(field: string, value: MongoQueryFieldOperators) {
    const conditions: Condition[] = [];
    Object.keys(value).forEach((op) => {
      if (op[0] !== '$') {
        throw new Error(`Field query for "${field}" may contain only operators or a plain object as a value`);
      }

      const condition = this._parseField(field, op, value[op as FieldOperatorName], value);

      if (condition !== NULL_CONDITION) {
        conditions.push(condition);
      }
    });

    return conditions;
  }

  parse<T extends MongoQuery<any>>(rawQuery: T, options?: ParseOptions) {
    if (options && options.field) {
      return and(...this._parseFieldOperators(options.field, rawQuery as MongoQueryFieldOperators));
    }

    const query = rawQuery as MongoQuery;
    const defaultContext = { query, parse: this.parse };
    const mainCondition = Object.keys(query).reduce((rootCondition, key) => {
      const value = query[key];
      const isOperator = key[0] === '$';
      const instruction = this._instructions[key];

      if (isOperator && !instruction) {
        throw new Error(`Unsupported operator "${key}"`);
      }

      if (isOperator && (instruction.type === 'document' || instruction.type === 'compound')) {
        if (instruction.validate) {
          instruction.validate(instruction, value);
        }

        type Parse = typeof instruction.parse;
        const parse: Parse = instruction.parse || defaultParsers[instruction.type];
        const condition = parse(instruction, value, defaultContext);
        return and(rootCondition, condition);
      }

      if (isOperator) {
        throw new Error(`Unknown top level operator "${key}"`);
      }

      if (hasOperators(value)) {
        return and(rootCondition, ...this._parseFieldOperators(key, value));
      }

      return and(rootCondition, this._parseField(key, '$eq', value, query));
    }, and());

    if (isCompound('and', mainCondition) && mainCondition.value.length === 1) {
      return mainCondition.value[0];
    }

    return mainCondition;
  }
}
