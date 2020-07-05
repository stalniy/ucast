import { CompoundCondition, FieldCondition, NamedInstruction, CompoundInstruction, FieldInstruction, ValueInstruction, Comparable, ITSELF, FieldParsingContext } from '@ucast/core';
import { tryToSimplifyCompoundCondition } from './MongoQueryParser';
import { MongoQuery } from './types';

function ensureIsArray(instruction: NamedInstruction, value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(`"${instruction.name}" expects value to be an array`);
  }
}

function ensureIsComparable(instruction: NamedInstruction, value: string | number | Date) {
  const isComparable = typeof value === 'string' || typeof value === 'number' || value instanceof Date;

  if (!isComparable) {
    throw new Error(`"${instruction.name}" expects value to be comparable (i.e., string, number or date)`);
  }
}

const ensureIs = (type: string) => (instruction: NamedInstruction, value: unknown) => {
  if (typeof value !== type) {
    throw new Error(`"${instruction.name}" expects value to be a "${type}"`);
  }
};

export const $and: CompoundInstruction<MongoQuery<any>[]> = {
  type: 'compound',
  validate: ensureIsArray,
  parse(instruction, queries, { parse }) {
    const conditions = queries.map(query => parse(query));
    return tryToSimplifyCompoundCondition(instruction.name, conditions);
  }
};
export const $or = $and;
export const $nor: CompoundInstruction<MongoQuery<any>[]> = {
  type: 'compound',
  validate: ensureIsArray,
};

export const $not: FieldInstruction<MongoQuery<any> | RegExp> = {
  type: 'field',
  validate(instruction, value) {
    if (!value || !(value instanceof RegExp) || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`"${instruction.name}" expects to receive either regular expression or object of field operators`);
    }
  },
  parse(instruction, value, context) {
    const condition = value instanceof RegExp
      ? new FieldCondition('$regex' as typeof instruction.name, context.field, value)
      : context.parse(value, context);

    return new CompoundCondition(instruction.name, [condition]);
  },
};
export const $elemMatch: FieldInstruction<MongoQuery<any>> = {
  type: 'field',
  parse(instruction, value, { parse, field }) {
    const isValueBased = Object.keys(value).every(key => key[0] === '$');
    const condition = isValueBased ? parse(value, { field: ITSELF }) : parse(value);

    return new FieldCondition(instruction.name, field, condition);
  }
};

export const $size: FieldInstruction<number> = {
  type: 'field',
  validate: ensureIs('number')
};
export const $in: FieldInstruction<unknown[]> = {
  type: 'field',
  validate: ensureIsArray,
}
export const $nin = $in;
export const $mod: FieldInstruction<[number, number]> = {
  type: 'field',
  validate(instruction, value) {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(`"${instruction.name}" expects and array with 2 elements`);
    }
  }
};

export const $exists: FieldInstruction<boolean> = {
  type: 'field',
  validate: ensureIs('boolean'),
}

export const $gte: FieldInstruction<Comparable> = {
  type: 'field',
  validate: ensureIsComparable
}
export const $gt = $gte;
export const $lt = $gt;
export const $lte = $gt;

export const $eq: FieldInstruction = {
  type: 'field',
};
export const $ne = $eq;
export const $type: FieldInstruction<string> = {
  type: 'field',
  validate: ensureIs('string'),
}

interface RegExpFieldContext extends FieldParsingContext {
  query: {
    $options?: string
  }
}

export const $regex: FieldInstruction<string | RegExp, RegExpFieldContext> = {
  type: 'field',
  validate(instruction, value) {
    if (!(value instanceof RegExp) && typeof value !== 'string') {
      throw new Error(`"${instruction.name}" expects value to be a regular expression or a string that represents regular expression`);
    }
  },
  parse(instruction, rawValue, context) {
    const value = typeof rawValue === 'string'
      ? new RegExp(rawValue, context.query.$options || '')
      : rawValue;
    return new FieldCondition(instruction.name, context.field, value);
  }
}
export const $options: FieldInstruction = $eq;
export const $where: ValueInstruction<() => boolean> = {
  type: 'value',
  validate: ensureIs('function'),
};
