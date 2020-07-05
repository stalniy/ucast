import { Condition, FieldCondition, CompoundCondition, ValueCondition, NamedInstruction, ParsingInstruction, ValueInstruction, CompoundInstruction, FieldInstruction, Named } from '@ucast/core';
import { MongoQuery, MongoQueryFieldOperators, MongoQueryOperators } from './types';

function isCompound(operator: string, condition: Condition): condition is CompoundCondition {
  return condition instanceof CompoundCondition && condition.operator === operator;
}

export function tryToSimplifyCompoundCondition(operator: string, conditions: Condition[]): Condition {
  if (conditions.length === 1) {
    return conditions[0];
  }

  const firstNode = conditions[0];

  if (isCompound(operator, firstNode)) {
    for (let i = 1, length = conditions.length; i < length; i++) {
      const currentNode = conditions[i];

      if (isCompound(operator, currentNode)) {
        firstNode.add(currentNode.value);
      } else {
        firstNode.add(currentNode);
      }
    }

    return firstNode;
  }

  return new CompoundCondition(operator, conditions);
}

function and(...conditions: Condition[]) {
  return tryToSimplifyCompoundCondition('$and', conditions);
}

interface DefaultParsers {
  compound: Exclude<CompoundInstruction<MongoQuery[]>['parse'], undefined>,
  field: Exclude<FieldInstruction['parse'], undefined>,
  value: Exclude<ValueInstruction['parse'], undefined>
}

export const defaultParsers: DefaultParsers = {
  compound(instruction, queries, context) {
    const conditions = queries.map(query => context.parse(query));
    return new CompoundCondition(instruction.name, conditions);
  },
  field(instruction, value, context) {
    return new FieldCondition(instruction.name, context.field, value);
  },
  value(instruction, value) {
    return new ValueCondition(instruction.name, value);
  }
}

type ParsingInstructions = Record<string, NamedInstruction>;

export interface ParseOptions {
  field: string
}

export class MongoQueryParser {
  private readonly _instructions: ParsingInstructions;

  constructor(instructions: Record<string, ParsingInstruction>) {
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { ...instructions[name], name };
      return all;
    }, {} as ParsingInstructions);
    this.parse = this.parse.bind(this);
  }

  private _parseField(field: string, operator: string, value: unknown, parentQuery: unknown): Condition {
    const instruction = this._instructions[operator]

    if (!instruction) {
      throw new Error(`Unsupported operator "${operator}"`);
    }

    if (instruction.type === 'value') {
      throw new Error(`Unexpected value "${operator}" at field level`);
    }

    if (instruction.validate) {
      instruction.validate(instruction, value);
    }

    const parse: Function = instruction.parse || defaultParsers.field;
    return parse(instruction, value, { field, query: parentQuery, parse: this.parse });
  }

  private _parseFieldOperators(field: string, value: MongoQueryFieldOperators) {
    return Object.keys(value).map((op) => {
      if (op[0] !== '$') {
        throw new Error(`Field query for "${field}" may contain only operators or a plain object as a value`);
      }

      return this._parseField(field, op, value[op as keyof MongoQueryFieldOperators], value);
    })
  }

  parse(rawQuery: MongoQuery<any>, options?: ParseOptions): Condition {
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

      if (isOperator && (instruction.type === 'value' || instruction.type === 'compound')) {
        if (instruction.validate) {
          instruction.validate(instruction, value);
        }

        const parse: typeof instruction.parse = instruction.parse || defaultParsers[instruction.type];
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

    if (mainCondition instanceof CompoundCondition && mainCondition.value.length === 1) {
      return mainCondition.value[0];
    }

    return mainCondition;
  }
}

function hasOperators(value: any): value is MongoQueryOperators {
  if (value && value.constructor !== Object) {
    return false;
  }

  for (const prop in value) {
    if (prop[0] === '$') {
      return true;
    }
  }

  return false;
}
