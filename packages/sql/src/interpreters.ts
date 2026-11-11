import {
  CompoundCondition,
  FieldCondition,
  type Condition,
  type Comparable
} from '@ucast/core';
import {
  dialectSpecificOperator,
  type SqlOperator,
} from './interpreter.ts';

export const eq: SqlOperator<FieldCondition> = (condition, { sql, field, param }) => {
  return condition.value === null
    ? sql`${field(condition.field)} is null`
    : sql`${field(condition.field)} = ${param(condition)}`;
};

export const ne: SqlOperator<FieldCondition> = (condition, { sql, field, param }) => {
  return condition.value === null
    ? sql`${field(condition.field)} is not null`
    : sql`${field(condition.field)} <> ${param(condition)}`;
};

export const lt: SqlOperator<FieldCondition<Comparable>> = (condition, { sql, field, param }) => {
  return sql`${field(condition.field)} < ${param(condition)}`;
};
export const lte: SqlOperator<FieldCondition<Comparable>> = (condition, { sql, field, param }) => {
  return sql`${field(condition.field)} <= ${param(condition)}`;
};
export const gt: SqlOperator<FieldCondition<Comparable>> = (condition, { sql, field, param }) => {
  return sql`${field(condition.field)} > ${param(condition)}`;
};
export const gte: SqlOperator<FieldCondition<Comparable>> = (condition, { sql, field, param }) => {
  return sql`${field(condition.field)} >= ${param(condition)}`;
};

export const exists: SqlOperator<FieldCondition<Comparable>> = (condition, { sql, field }) => {
  return condition.value
    ? sql`${field(condition.field)} is not null`
    : sql`${field(condition.field)} is null`;
};

export const within: SqlOperator<FieldCondition<unknown[]>> = (
  condition, { sql, field, manyParams }
) => sql`${field(condition.field)} in(${manyParams(condition)})`;
export const nin: SqlOperator<FieldCondition<unknown[]>> = (
  condition, { sql, field, manyParams }
) => sql`${field(condition.field)} not in(${manyParams(condition)})`;

export const mod: SqlOperator<FieldCondition<[number, number]>> = (
  condition, { sql, field, param }
) => sql`mod(${field(condition.field)}, ${param(condition.value[0])}) = ${param(condition.value[1])}`;

export const regex = dialectSpecificOperator<FieldCondition<RegExp>, 'regex'>('regex', {
  posix(condition, { sql, field, param, raw }) {
    const op = condition.value.ignoreCase ? '~*' : '~';
    return sql`${field(condition.field)} ${raw(op)} ${param(condition.value.source)}`;
  },
  regexp(condition, { sql, field, param }) {
    return sql`${field(condition.field)} regexp ${param(condition.value.source)} = 1`;
  },
  regexpLike(condition, { sql, field, param }) {
    const pattern = condition.value;
    const flags = (pattern.ignoreCase ? 'i' : 'c')
      + (pattern.multiline ? 'm' : '')
      + (pattern.dotAll ? 's' : '');
    return sql`REGEXP_LIKE(${field(condition.field)}, ${param(pattern.source)}, ${param(flags)})`;
  }
});

function validateLikePattern(pattern: string) {
  if (typeof pattern !== 'string') throw new Error('LIKE pattern must be a string');
  let trailingSlashes = 0;
  for (let i = pattern.length - 1; i >= 0 && pattern[i] === '\\'; i--) {
    trailingSlashes++;
  }
  if (trailingSlashes % 2 !== 0) {
    throw new Error('LIKE pattern must not end with an unpaired backslash');
  }
}

const escapeBrackets = (value: string) => value.replace(/\\[\s\S]|\[/g, match => match === '[' ? '\\[' : match);
const DEFAULT_LIKE_ESCAPE_CHAR = "'\\'";
export const like: SqlOperator<FieldCondition<string>> = (
  condition,
  { sql, field, param, raw, features }
) => {
  validateLikePattern(condition.value);
  const escapeChar = features.like.escapeCharacter ?? DEFAULT_LIKE_ESCAPE_CHAR;
  const pattern = features.like.supportsBrackets
    ? escapeBrackets(condition.value)
    : condition.value;
  return sql`${field(condition.field)} LIKE ${param(pattern)} ESCAPE ${raw(escapeChar)}`;
};

export const ilike = dialectSpecificOperator<FieldCondition<string>, 'ilike'>('ilike', {
  native(condition, { sql, field, param, raw, features }) {
    const escapeChar = features.like.escapeCharacter ?? DEFAULT_LIKE_ESCAPE_CHAR;
    const pattern = features.like.supportsBrackets
      ? escapeBrackets(condition.value)
      : condition.value;
    return sql`${field(condition.field)} ILIKE ${param(pattern)} ESCAPE ${raw(escapeChar)}`;
  },
  lower(condition, { sql, field, param, raw, features }) {
    const escapeChar = features.like.escapeCharacter ?? DEFAULT_LIKE_ESCAPE_CHAR;
    const pattern = features.like.supportsBrackets
      ? escapeBrackets(condition.value)
      : condition.value;
    return sql`LOWER(${field(condition.field)}) LIKE LOWER(${param(pattern)}) ESCAPE ${raw(escapeChar)}`;
  }
}, { validate: validateLikePattern });

function compoundOperator(combinator: 'and' | 'or', isInverted = false) {
  const separator = ` ${combinator} `;
  return ((node, composer, { interpret }) => {
    const fragments = node.value.map(condition => interpret(condition, composer));
    const fragment = composer.join(fragments, composer.raw(separator));
    return isInverted ? composer.sql`not (${fragment})` : composer.sql`(${fragment})`;
  }) satisfies SqlOperator<CompoundCondition>;
}

export const not = compoundOperator('and', true);
export const and = compoundOperator('and');
export const or = compoundOperator('or');
export const nor = compoundOperator('or', true);

export const someRelation = relationOperator(false, false);
export const noneRelation = relationOperator(true, false);
export const everyRelation = relationOperator(true, true);

function relationOperator(
  isInverted: boolean,
  invertCondition: boolean
): SqlOperator<FieldCondition<Condition>> {
  return (condition, { sql, relation }, context) => {
    const related = relation(condition.field);
    const predicate = context.interpret(
      condition.value,
      related.composer,
    );
    const subquery = related.subquery(invertCondition ? sql`NOT (${predicate})` : predicate);

    return isInverted ? sql`NOT EXISTS (${subquery})` : sql`EXISTS (${subquery})`;
  };
}
