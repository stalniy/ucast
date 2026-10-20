import {
  CompoundCondition,
  FieldCondition,
  type Condition,
  type Comparable
} from '@ucast/core';
import {
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

// type IElemMatch = SqlOperator<FieldCondition<Condition>>;
// export const elemMatch: IElemMatch = (condition, query, { interpret }) => {
//   return query.usingFieldPrefix(condition.field, () => interpret(condition.value, query));
// };

export const regex: SqlOperator<FieldCondition<RegExp>> = (condition, { sql, field, param, regexp, raw }) => {
  const regexpDetails = regexp(condition.value.ignoreCase);
  return sql`${field(condition.field)} ${raw(regexpDetails.operator)} ${param(condition.value.source)}${raw(regexpDetails.comparator)}`;
};

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

function relationOperator(isInverted: boolean, invertCondition: boolean): SqlOperator<FieldCondition<Condition>> {
  return (condition, { sql, relation }, context) => {
    const related = relation(condition.field);
    const predicate = context.interpret(
      condition.value,
      related.composer,
    );

    return isInverted
      ? sql`NOT EXISTS (${related.subquery(predicate, invertCondition)})`
      : sql`EXISTS (${related.subquery(predicate, invertCondition)})`;
  };
}
