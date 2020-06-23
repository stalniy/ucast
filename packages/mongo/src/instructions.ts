import { CompoundCondition, FieldCondition, NamedOperatorInstruction, CompoundOperatorInstruction, FieldOperatorInstruction } from '@muast/ast';
import { tryToSimplifyCompoundCondition } from './Parser';
import { MongoQuery, Comparable } from './types';

function ensureIsArray(instruction: NamedOperatorInstruction, value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(`"${instruction.name}" expects value to be an array`);
  }
}

function ensureIsComparable(instruction: NamedOperatorInstruction, value: string | number | Date) {
  const isComparable = typeof value === 'string' || typeof value === 'number' || value instanceof Date;

  if (!isComparable) {
    throw new Error(`"${instruction.name}" expects value to be comparable (i.e., string, number or date)`);
  }
}

const ensureIs = (type: string) => (instruction: NamedOperatorInstruction, value: unknown) => {
  if (typeof value !== type) {
    throw new Error(`"${instruction.name}" expects value to be a "${type}"`);
  }
};

export const $and: CompoundOperatorInstruction = {
  type: 'compound',
  validate: ensureIsArray,
  parse(parse, instruction, queries: MongoQuery[]) {
    const conditions = queries.map(query => parse(query));
    return tryToSimplifyCompoundCondition(instruction.name, conditions);
  }
};
export const $or = $and;
export const $nor: CompoundOperatorInstruction = {
  type: 'compound',
  validate: ensureIsArray,
};

export const $not: FieldOperatorInstruction = {
  type: 'field',
  validate(instruction, value) {
    if (!value || (typeof value !== 'object' && !(value instanceof RegExp)) || Array.isArray(value)) {
      throw new Error(`"${instruction.name}" expects to receive either regular expression or object of field operators`);
    }
  },
  parse(parse, instruction, field: string, value) {
    const condition = value instanceof RegExp
      ? new FieldCondition('$regex', field, value)
      : parse(value, { field });

    return new CompoundCondition(instruction.name, [condition]);
  },
};
export const $elemMatch: FieldOperatorInstruction<Record<string, any>> = {
  type: 'field',
  parse(parse, instruction, field, value) {
    const isValueBased = Object.keys(value).every(key => key[0] === '$');
    const condition = isValueBased ? parse(value, { field }) : parse(value);
    return new FieldCondition(instruction.name, field, condition);
  }
};

export const $size: FieldOperatorInstruction<number> = {
  type: 'field',
  validate: ensureIs('number')
};
export const $in: FieldOperatorInstruction<unknown[]> = {
  type: 'field',
  validate: ensureIsArray,
}
export const $nin = $in;
export const $mod: FieldOperatorInstruction<[number, number]> = {
  type: 'field',
  validate(instruction, value) {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error(`"${instruction.name}" expects and array with 2 elements`);
    }
  }
};

export const $exists: FieldOperatorInstruction<boolean> = {
  type: 'field',
  validate: ensureIs('boolean'),
}

export const $gte: FieldOperatorInstruction<Comparable> = {
  type: 'field',
  validate: ensureIsComparable
}
export const $gt = $gte;
export const $lt = $gt;
export const $lte = $gt;

export const $eq: FieldOperatorInstruction = {
  type: 'field',
};
export const $ne = $eq;
export const $type: FieldOperatorInstruction<string> = {
  type: 'field',
  validate: ensureIs('string'),
}
export const $regex: FieldOperatorInstruction = {
  type: 'field',
  validate(instruction, value) {
    if (!(value instanceof RegExp) && typeof value !== 'string') {
      throw new Error(`"${instruction.name}" expects value to be a regular expression or a string that represents regular expression`);
    }
  },
  parse(_, instruction, field, rawValue, query: Record<string, any>) {
    const value = typeof rawValue === 'string'
      ? new RegExp(rawValue, query.$options || '')
      : rawValue;
    return new FieldCondition(instruction.name, field, value);
  }
}
export const $options: FieldOperatorInstruction = {
  type: 'field'
};
export const $where: FieldOperatorInstruction = {
  type: 'field'
}
