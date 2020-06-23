import { Condition, FieldCondition, CompoundCondition, NamedOperatorInstruction, OperatorInstruction, CompoundOperatorInstruction, FieldOperatorInstruction } from '@muast/ast';
import { MongoQuery, MongoQueryOperators } from './types';

export function tryToSimplifyCompoundCondition(operator: string, conditions: Condition[]): Condition {
  const first = conditions[0];

  if (conditions.length === 1) {
    return first;
  }

  if (first && first instanceof CompoundCondition && first.operator === operator) {
    first.merge(conditions.slice(1));
    return first;
  }

  return new CompoundCondition(operator, conditions);
}

const and = (...conditions: Condition[]) => tryToSimplifyCompoundCondition('$and', conditions);

export const defaultCompoundInstruction: CompoundOperatorInstruction<MongoQuery[]> = {
  type: 'compound',
  parse(parse, instruction, queries) {
    const conditions = queries.map(query => parse(query));
    return new CompoundCondition(instruction.name, conditions);
  }
};

export const defaultFieldInstruction: FieldOperatorInstruction = {
  type: 'field',
  parse(_, instruction, field, value) {
    return new FieldCondition(instruction.name, field, value);
  }
};

type ParsingInstructions = Record<string, NamedOperatorInstruction>;

export interface ParserOptions {
  field: string
}

export class Parser {
  private readonly _instructions: ParsingInstructions;

  constructor(instructions: Record<string, OperatorInstruction>) {
    this._instructions = Object.keys(instructions).reduce((all, name) => {
      all[name] = { ...instructions[name], name };
      return all;
    }, {} as ParsingInstructions);
    this.parse = this.parse.bind(this);
  }

  private _parseField(field: string, operator: string, value: unknown, parentQuery: unknown) {
    const instruction = this._instructions[operator]

    if (!instruction) {
      throw new Error(`Unsupported operator "${operator}"`)
    }

    if (instruction.type === 'compound') {
      throw new Error(`Unexpected compound "${operator}" at field level`);
    }

    if (instruction.validate) {
      instruction.validate(instruction, value);
    }

    const parse = instruction.parse || defaultFieldInstruction.parse!;
    return parse(this.parse, instruction, field, value, parentQuery);
  }

  private _parseFieldOperators(field: string, value: any) {
    return Object.keys(value).map((op) => {
      if (op[0] !== '$') {
        throw new Error(`Field in "${field}" expression may contain only operators or a plain object as a value`);
      }

      return this._parseField(field, op, value[op], value);
    })
  }

  parse(rootQuery: MongoQuery | MongoQueryOperators, options?: ParserOptions): Condition {
    if (options && options.field) {
      return and(...this._parseFieldOperators(options.field, rootQuery));
    }

    const mainCondition = Object.keys(rootQuery).reduce((rootCondition, key) => {
      const value = (rootQuery as any)[key];
      const isOperator = key[0] === '$';
      const instruction = this._instructions[key];


      if (isOperator && !instruction) {
        throw new Error(`Unsupported operator "${key}"`);
      }

      if (isOperator && instruction.type === 'compound') {
        if (instruction.validate) {
          instruction.validate(instruction, value);
        }

        const parse = instruction.parse || defaultCompoundInstruction.parse!;
        const condition = parse(this.parse, instruction, value, rootQuery);
        return and(rootCondition, condition);
      }

      if (isOperator) {
        throw new Error(`Unknown top level operator "${key}"`);
      }

      if (hasOperators(value)) {
        return and(rootCondition, ...this._parseFieldOperators(key, value));
      }

      return and(rootCondition, this._parseField(key, '$eq', value, rootQuery));
    }, and());

    if (!(mainCondition instanceof CompoundCondition)) {
      return mainCondition;
    }

    if (mainCondition.conditions.length === 1) {
      return mainCondition.conditions[0];
    }

    return mainCondition;
  }
}

function hasOperators(value: any) {
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
