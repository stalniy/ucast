import {
  CompoundCondition,
  FieldCondition,
  NamedInstruction,
  CompoundInstruction,
  FieldInstruction,
  DocumentInstruction,
  Comparable,
  ITSELF,
  NULL_CONDITION,
  FieldParsingContext
} from '@ucast/core';
import { tryToSimplifyCompoundCondition, hasOperators } from './utils';
import { MongoQuery } from './types';

function ensureIsArray(instruction: NamedInstruction, value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(`"${instruction.name}" expects value to be an array`);
  }
}

function ensureIsNonEmptyArray(instruction: NamedInstruction, value: unknown[]) {
  ensureIsArray(instruction, value);

  if (!value.length) {
    throw new Error(`"${instruction.name}" expects to have at least one element in array`);
  }
}

function ensureIsComparable(instruction: NamedInstruction, value: string | number | Date) {
  const isComparable = typeof value === 'string' || typeof value === 'number' || value instanceof Date;

  if (!isComparable) {
    throw new Error(`"${instruction.name}" expects value to be comparable (i.e., string, number or date)`);
  }
}

const ensureIs = (type: string) => (instruction: NamedInstruction, value: unknown) => {
  if (typeof value !== type) { // eslint-disable-line valid-typeof
    throw new Error(`"${instruction.name}" expects value to be a "${type}"`);
  }
};

export const $and: CompoundInstruction<MongoQuery<any>[]> = {
  type: 'compound',
  validate: ensureIsNonEmptyArray,
  parse(instruction, queries, { parse }) {
    const conditions = queries.map(query => parse(query));
    return tryToSimplifyCompoundCondition(instruction.name, conditions);
  }
};
export const $or = $and;
export const $nor: CompoundInstruction<MongoQuery<any>[]> = {
  type: 'compound',
  validate: ensureIsNonEmptyArray,
};

export const $not: FieldInstruction<MongoQuery<any> | RegExp> = {
  type: 'field',
  validate(instruction, value) {
    const isValid = value && (value instanceof RegExp || value.constructor === Object);

    if (!isValid) {
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
  validate(instruction, value) {
    if (!value || value.constructor !== Object) {
      throw new Error(`"${instruction.name}" expects to receive an object with nested query or field level operators`);
    }
  },
  parse(instruction, value, { parse, field }) {
    const condition = hasOperators(value) ? parse(value, { field: ITSELF }) : parse(value);
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
};
export const $nin = $in;
export const $all = $in;
export const $mod: FieldInstruction<[number, number]> = {
  type: 'field',
  validate(instruction, value) {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(`"${instruction.name}" expects an array with 2 numeric elements`);
    }
  }
};

export const $exists: FieldInstruction<boolean> = {
  type: 'field',
  validate: ensureIs('boolean'),
};

export const $gte: FieldInstruction<Comparable> = {
  type: 'field',
  validate: ensureIsComparable
};
export const $gt = $gte;
export const $lt = $gt;
export const $lte = $gt;

export const $eq: FieldInstruction = {
  type: 'field',
};
export const $ne = $eq;

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
};
export const $options: FieldInstruction = {
  type: 'field',
  parse: () => NULL_CONDITION,
};

export const $where: DocumentInstruction<() => boolean> = {
  type: 'document',
  validate: ensureIs('function'),
};
