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
  type Query
} from './interpreter.ts';

export const eq: SqlOperator<FieldCondition> = (condition, query) => {
  if (condition.value === null) {
    return query.whereRaw(`${query.field(condition.field)} is null`);
  }
  return query.where(condition.field, '=', condition.value);
};

export const ne: typeof eq = (condition, query) => {
  if (condition.value === null) {
    return query.whereRaw(`${query.field(condition.field)} is not null`);
  }
  return query.where(condition.field, '<>', condition.value);
};

export const lt: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<', condition.value);
};

export const lte: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '<=', condition.value);
};

export const gt: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>', condition.value);
};

export const gte: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.where(condition.field, '>=', condition.value);
};

export const exists: SqlOperator<FieldCondition<Comparable>> = (condition, query) => {
  return query.whereRaw(`${query.field(condition.field)} is ${condition.value ? 'not ' : ''}null`);
};

function manyParamsOperator(name: 'in' | 'not in'): SqlOperator<FieldCondition<unknown[]>> {
  return (condition, query) => {
    return query.whereRaw(
      `${query.field(condition.field)} ${name}(${query.manyParams(condition.value).join(', ')})`,
    );
  };
}

export const within = manyParamsOperator('in');
export const nin = manyParamsOperator('not in');

export const mod: SqlOperator<FieldCondition<[number, number]>> = (condition, query) => {
  const params = query.manyParams(condition.value);
  return query.whereRaw(`mod(${query.field(condition.field)}, ${params[0]}) = ${params[1]}`);
};

type IElemMatch = SqlOperator<FieldCondition<Condition>>;
export const elemMatch: IElemMatch = (condition, query, { interpret }) => {
  return query.usingFieldPrefix(condition.field, () => interpret(condition.value, query));
};

export const regex: SqlOperator<FieldCondition<RegExp>> = (condition, query) => {
  const sql = query.options.regexp(
    query.field(condition.field),
    query.param(condition.value.source),
    condition.value.ignoreCase
  );
  return query.whereRaw(sql);
};

function compoundOperator(combinator: 'and' | 'or', isInverted = false) {
  const childOptions = { linkParams: true };
  return ((node, query, { interpret }) => {
    const childQuery = query.child(childOptions);
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
  const escape = query.options.escapeField;
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
  return (condition, query, { interpret }) => {
    const relation = getRelationMetadata(query, condition.field);
    const relationAlias = query.nextRelationAlias(condition.field);
    const conditionSql = createRelationConditionSql(
      condition,
      query,
      relation,
      relationAlias,
      invertCondition,
      interpret,
    );
    const relationSql = buildRelationQuery(
      query,
      condition.field,
      relation,
      relationAlias,
      conditionSql
    );

    return query.whereRaw(`${isInverted ? 'NOT ' : ''}EXISTS (${relationSql})`);
  };
}

function createRelationConditionSql(
  condition: FieldCondition<Condition>,
  query: Query,
  relation: RelationMetadata,
  relationAlias: string,
  shouldInvert: boolean,
  interpret: (condition: Condition, query: Query) => Query,
) {
  let sql: string | undefined;

  return () => {
    if (sql !== undefined) {
      return sql;
    }

    const childQuery = query.child({
      linkParams: true,
      rootAlias: relationAlias,
      relationContext: relation.relationContext,
    });

    interpret(condition.value, childQuery);
    const [whereSql] = childQuery.toJSON();
    sql = shouldInvert ? `NOT (${whereSql})` : whereSql;
    return sql;
  };
}

function buildRelationQuery(
  query: Query,
  relationName: string,
  relation: RelationMetadata,
  relationAlias: string,
  conditionSql: () => string,
) {
  const escapeField = query.options.escapeField;
  const context = {
    relationName,
    relationAlias,
    parentAlias: query.rootAlias,
    escapeField,
    parentField: (field: string) => query.rootField(field),
    relationField: (field: string) => `${escapeField(relationAlias)}.${escapeField(field)}`,
    conditionSql,
    param: (value: unknown) => query.param(value),
  };

  if (isCustomRelationMetadata(relation)) {
    return relation.buildRelationQuery(context);
  }

  return buildSimpleRelationQuery(relation, context);
}

function buildSimpleRelationQuery(
  relation: SimpleRelationMetadata,
  context: {
    relationAlias: string;
    escapeField(field: string): string;
    parentField(field: string): string;
    relationField(field: string): string;
    conditionSql(): string;
  },
) {
  return `SELECT 1 FROM ${context.escapeField(relation.relationTable)} as ${context.escapeField(context.relationAlias)}` +
  ` WHERE ${context.parentField(relation.parentField)} = ${context.relationField(relation.relationField)}` +
  ` AND (${context.conditionSql()})`;
}

function isCustomRelationMetadata(relation: RelationMetadata): relation is CustomRelationMetadata {
  return typeof (relation as CustomRelationMetadata).buildRelationQuery === 'function';
}
