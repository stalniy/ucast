import {
  CompoundCondition,
  FieldCondition,
  type Condition,
  type Comparable
} from '@ucast/core';
import {
  type CustomRelationMetadata,
  type RelationMetadata,
  type SimpleRelationMetadata,
  type SqlOperator,
  type Query,
  type SqlInterpretationContext,
  type RelationQueryContext
} from './interpreter.ts';

export const eq: SqlOperator<FieldCondition> = (condition, query, { sql, param }) => {
  const fragment =  condition.value === null
    ? sql`${query.field(condition.field)} is null`
    : sql`${query.field(condition.field)} = ${param(condition.value)}`;
  return query.where(fragment);
};

export const ne: SqlOperator<FieldCondition> = (condition, query, { sql, param }) => {
  const fragment =  condition.value === null
    ? sql`${query.field(condition.field)} is not null`
    : sql`${query.field(condition.field)} <> ${param(condition.value)}`;
  return query.where(fragment);
};

export const lt: SqlOperator<FieldCondition<Comparable>> = (condition, query, { sql, param }) => {
  return query.where(sql`${query.field(condition.field)} < ${param(condition.value)}`);
};
export const lte: SqlOperator<FieldCondition<Comparable>> = (condition, query, { sql, param }) => {
  return query.where(sql`${query.field(condition.field)} <= ${param(condition.value)}`);
};
export const gt: SqlOperator<FieldCondition<Comparable>> = (condition, query, { sql, param }) => {
  return query.where(sql`${query.field(condition.field)} > ${param(condition.value)}`);
};
export const gte: SqlOperator<FieldCondition<Comparable>> = (condition, query, { sql, param }) => {
  return query.where(sql`${query.field(condition.field)} >= ${param(condition.value)}`);
};

export const exists: SqlOperator<FieldCondition<Comparable>> = (condition, query, { sql, raw }) =>
  query.where(sql`${query.field(condition.field)} is ${raw(condition.value ? 'not ' : '')}null`);

export const within: SqlOperator<FieldCondition<unknown[]>> = (
  condition, query, { sql, manyParams }
) => query.where(sql`${query.field(condition.field)} in(${manyParams(condition.value)})`);
export const nin: SqlOperator<FieldCondition<unknown[]>> = (
  condition, query, { sql, manyParams }
) => query.where(sql`${query.field(condition.field)} not in(${manyParams(condition.value)})`);

export const mod: SqlOperator<FieldCondition<[number, number]>> = (
  condition, query, { sql, param }
) => query.where(sql`mod(${query.field(condition.field)}, ${param(condition.value[0])}) = ${param(condition.value[1])}`);

type IElemMatch = SqlOperator<FieldCondition<Condition>>;
export const elemMatch: IElemMatch = (condition, query, { interpret }) => {
  return query.usingFieldPrefix(condition.field, () => interpret(condition.value, query));
};

export const regex: SqlOperator<FieldCondition<RegExp>> = (condition, query, { param, regexp }) => {
  const field = query.field(condition.field);
  const value = param(condition.value.source);
  return query.where(regexp(field, value, condition.value.ignoreCase));
};

function compoundOperator(combinator: 'and' | 'or', isInverted = false) {
  return ((node, query, { interpret }) => {
    const childQuery = query.child();
    node.value.forEach(condition => interpret(condition, childQuery));
    return query.merge(childQuery, combinator, isInverted);
  }) as SqlOperator<CompoundCondition>;
}

export const not = compoundOperator('and', true);
export const and = compoundOperator('and');
export const or = compoundOperator('or');
export const nor = compoundOperator('or', true);

export const someRelation = relationOperator(false, false);
export const noneRelation = relationOperator(true, false);
export const everyRelation = relationOperator(true, true);
export const isRelation = someRelation;
export const isNotRelation = noneRelation;

function getRelationMetadata(query: Query, relationName: string) {
  const escape = query.options.escapeIdentifier;
  const relation = query.options.getRelationMetadata?.(
    relationName,
    {
      escape,
      relationContext: query.relationContext,
    },
  );
  if (!relation) {
    throw new Error(`Relation metadata for "${relationName}" not found`);
  }

  return relation;
}

function relationOperator(
  isInverted: boolean,
  invertCondition: boolean
): SqlOperator<FieldCondition<Condition>> {
  return (condition, query, context) => {
    const { interpret } = context;
    const relation = getRelationMetadata(query, condition.field);
    const relationAlias = query.nextRelationAlias(condition.field);
    const conditionSql = createRelationConditionSql(
      condition,
      query,
      relation,
      relationAlias,
      invertCondition,
      interpret,
      context,
    );
    const relationSql = buildRelationQuery(
      query,
      condition.field,
      relation,
      relationAlias,
      conditionSql,
    );

    return query.where(context.sql`${context.raw(isInverted ? 'NOT ' : '')}EXISTS (${relationSql})`);
  };
}

function createRelationConditionSql(
  condition: FieldCondition<Condition>,
  query: Query,
  relation: RelationMetadata,
  relationAlias: string,
  shouldInvert: boolean,
  interpret: (condition: Condition, query: Query) => Query,
  context: SqlInterpretationContext,
) {
  let fragment: ReturnType<Query['fragment']> | undefined;

  return () => {
    if (fragment !== undefined) {
      return fragment;
    }

    const childQuery = query.child({
      rootAlias: relationAlias,
      relationContext: relation.relationContext,
    });

    interpret(condition.value, childQuery);
    const whereSql = childQuery.fragment();
    fragment = shouldInvert ? context.sql`NOT (${whereSql})` : whereSql;
    return fragment;
  };
}

function buildRelationQuery(
  query: Query,
  relationName: string,
  relation: RelationMetadata,
  relationAlias: string,
  conditionSql: () => any,
) {
  const escapeIdentifier = query.options.escapeIdentifier;
  const relatedQuery = query.child({
    rootAlias: relationAlias,
    relationContext: relation.relationContext,
  });
  const context = {
    relationName,
    relationAlias,
    parentAlias: query.rootAlias,
    sql: query.backend.sql,
    raw: query.backend.raw,
    param: query.backend.param,
    manyParams: query.backend.manyParams,
    join: query.backend.join,
    regexp: query.backend.regexp,
    escapeIdentifier: (name: string) => query.backend.raw(escapeIdentifier(name)),
    parentField: (field: string) => query.rootField(field),
    relationField: (field: string) => relatedQuery.rootField(field),
    conditionSql,
  };

  if (isCustomRelationMetadata(relation)) {
    return relation.buildRelationQuery(context);
  }

  return buildSimpleRelationQuery(relation, context);
}

function buildSimpleRelationQuery(
  relation: SimpleRelationMetadata,
  context: RelationQueryContext<any>,
) {
  return context.sql`SELECT 1 FROM ${context.escapeIdentifier(relation.relationTable)} as ${context.escapeIdentifier(context.relationAlias)} WHERE ${context.parentField(relation.parentField)} = ${context.relationField(relation.relationField)} AND (${context.conditionSql()})`;
}

function isCustomRelationMetadata(relation: RelationMetadata): relation is CustomRelationMetadata {
  return typeof (relation as CustomRelationMetadata).buildRelationQuery === 'function';
}
