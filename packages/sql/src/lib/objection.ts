import { type Condition } from '@ucast/core';
import { type Model, type ModelClass, type QueryBuilder } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects,
  mysql,
  type SqlQueryOptions,
} from '../index.ts';
import {
  buildDirectRelationQuery,
  buildManyToManyRelationQuery,
  RelationColumnPair,
} from '../relationUtils.ts';

type GetRelationMetadata = Exclude<SqlQueryOptions['getRelationMetadata'], undefined>;

export interface ObjectionInterpreterOptions {
  getRelationMetadata?: GetRelationMetadata;
}

export const getRelationMetadata: GetRelationMetadata = (relationName, ctx) => {
  const Model = ctx.relationContext as ModelClass<Model>;
  const relation = Model.getRelation(relationName) as RuntimeRelation | undefined;

  if (!relation) {
    return undefined;
  }

  if (relation.joinTable) {
    return {
      relationContext: relation.relatedModelClass,
      buildRelationQuery: buildManyToManyRelationQuery(
        relation.joinTable,
        relation.relatedModelClass.tableName,
        throughColumnPairs(relation.ownerProp.cols, relation.joinTableOwnerProp.cols),
        throughColumnPairs(relation.relatedProp.cols, relation.joinTableRelatedProp.cols),
      ),
    };
  }

  const columnPairs: RelationColumnPair[] = relation.ownerProp.cols.map((localField, index) => ({
    parentField: localField,
    relationField: relation.relatedProp.cols[index],
  }));

  if (columnPairs.length === 1) {
    return {
      parentField: columnPairs[0].parentField,
      relationField: columnPairs[0].relationField,
      relationTable: relation.relatedModelClass.tableName,
      relationContext: relation.relatedModelClass,
    };
  }

  return {
    relationContext: relation.relatedModelClass,
    buildRelationQuery: buildDirectRelationQuery(
      relation.relatedModelClass.tableName,
      columnPairs,
    ),
  };
};

function createObjectionDialects(objectionOptions: ObjectionInterpreterOptions = {}) {
  return createDialects({
    getRelationMetadata: objectionOptions.getRelationMetadata ?? getRelationMetadata,
    paramPlaceholder: mysql.paramPlaceholder,
  });
}

export function createInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  objectionOptions: ObjectionInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters);
  const dialects = createObjectionDialects(objectionOptions);

  return <T extends Model>(condition: Condition, query: QueryBuilder<T>) => {
    const dialect = query.modelClass().knex().client.config.client as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error('Unsupported database dialect');
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      rootAlias: getRootAlias(query),
    }, query.modelClass());
    return query.whereRaw(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);

function getRootAlias<T extends Model>(query: QueryBuilder<T>) {
  const queryWithTableRefs = query as QueryBuilder<T> & {
    tableRefFor?(modelClass: ModelClass<Model>): string | undefined;
  };

  return queryWithTableRefs.tableRefFor?.(query.modelClass()) ?? query.modelClass().tableName;
}

function throughColumnPairs(relationFields: string[], throughFields: string[]) {
  return relationFields.map((field, index) => ({
    relationField: field,
    throughField: throughFields[index],
  }));
}

interface RuntimeRelation {
  ownerProp: RelationProperty;
  relatedProp: RelationProperty;
  ownerModelClass: ModelClass<Model>;
  relatedModelClass: ModelClass<Model>;
  joinTable?: string;
  joinTableOwnerProp: RelationProperty;
  joinTableRelatedProp: RelationProperty;
}

interface RelationProperty {
  cols: string[];
}
