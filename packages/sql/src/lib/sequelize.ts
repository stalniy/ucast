import { type Condition } from '@ucast/core';
import { type Association, type ModelStatic, Utils, literal } from 'sequelize';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects,
  mysql,
  type SqlQueryOptions,
} from '../index.ts';
import { buildManyToManyRelationQuery } from '../relationUtils.ts';

const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));

type GetRelationMetadata = Exclude<SqlQueryOptions['getRelationMetadata'], undefined>;

export interface SequelizeInterpreterOptions {
  getRelationMetadata?: GetRelationMetadata;
}

export const getRelationMetadata: GetRelationMetadata = (
  relationName,
  ctx,
) => {
  const Model = ctx.relationContext as ModelStatic<any>;
  if (!hasOwn(Model.associations, relationName)) return;

  const association = Model.associations[relationName] as RuntimeAssociation;

  if (association.associationType === 'BelongsTo') {
    return {
      parentField: association.identifierField,
      relationField: association.targetKeyField,
      relationTable: association.target.tableName,
      relationContext: association.target,
    };
  }

  if (association.associationType === 'HasOne' || association.associationType === 'HasMany') {
    return {
      parentField: association.sourceKeyField,
      relationField: association.identifierField,
      relationTable: association.target.tableName,
      relationContext: association.target,
    };
  }

  if (association.associationType === 'BelongsToMany') {
    const throughTable = association.throughModel?.tableName ?? association.through.model.tableName;

    return {
      relationContext: association.target,
      buildRelationQuery: buildManyToManyRelationQuery(
        throughTable,
        association.target.tableName,
        [{
          relationField: association.sourceKeyField,
          throughField: association.identifierField,
        }],
        [{
          relationField: association.targetKeyField,
          throughField: association.foreignIdentifierField,
        }],
      ),
    };
  }

  return undefined;
};

export function createInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  sequelizeOptions: SequelizeInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters);
  const dialects = createDialects({
    getRelationMetadata: sequelizeOptions.getRelationMetadata ?? getRelationMetadata,
    paramPlaceholder: mysql.paramPlaceholder,
  });

  return (condition: Condition, Model: ModelStatic<any>, callOptions?: { rootAlias?: string }) => {
    const dialect = Model.sequelize!.getDialect() as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      rootAlias: callOptions?.rootAlias ?? Model.tableName
    }, Model);
    return {
      where: literal(Utils.format([sql, ...(params as string[])], dialect)),
    };
  };
}

export const interpret = createInterpreter(allInterpreters);

type BelongsToAssociation = Association & {
  associationType: 'BelongsTo';
  target: ModelStatic<any>;
  identifierField: string;
  targetKeyField: string;
};

type HasAssociation = Association & {
  associationType: 'HasOne' | 'HasMany';
  target: ModelStatic<any>;
  identifierField: string;
  sourceKeyField: string;
};

type BelongsToManyAssociation = Association & {
  associationType: 'BelongsToMany';
  target: ModelStatic<any>;
  through: { model: ModelStatic<any> };
  throughModel?: ModelStatic<any>;
  identifierField: string;
  foreignIdentifierField: string;
  sourceKeyField: string;
  targetKeyField: string;
};

type RuntimeAssociation = BelongsToAssociation | HasAssociation | BelongsToManyAssociation;
