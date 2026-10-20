import { type Condition } from '@ucast/core';
import { literal, type Association, type BindOrReplacements, type ModelStatic } from 'sequelize';
import {
  allInterpreters,
  createDialects,
  createSqlInterpreter,
  mysql,
  type SqlEntityMetadata,
  type SqlOperator,
} from '../index.ts';

const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));

export function createSequelizeInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);
  const numericPlaceholderDialects = createDialects({
    paramPlaceholder: mysql.paramPlaceholder,
  });
  let callNumber = 0;
  const namedPlaceholderDialects = createDialects({
    paramPlaceholder: (index) => `:ucast_${callNumber}_${index}`
  });

  return (
    condition: Condition,
    Model: ModelStatic<any>,
    queryOptions?: SequelizeQueryOptions
  ): SequelizeInterpretationResult => {
    const dialect = Model.sequelize!.getDialect() as keyof typeof numericPlaceholderDialects;
    const options = queryOptions?.replacementMode === 'named'
      ? namedPlaceholderDialects[dialect]
      : numericPlaceholderDialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      alias: queryOptions?.alias ?? Model.tableName,
      metadata: sequelizeToSqlMetadata(Model)
    });
    const where = literal(sql);
    const replacements = queryOptions?.replacementMode === 'named'
      ? paramsToNamedReplacements(params, `ucast_${callNumber}`)
      : params.slice();
    callNumber++;

    return {
      where,
      replacements
    };
  };
}

export interface SequelizeInterpretationResult {
  where: ReturnType<typeof literal>;
  replacements: BindOrReplacements;
}

function paramsToNamedReplacements(params: readonly unknown[], placeholderPrefix: string) {
  const replacements: Record<string, unknown> = {};
  for (let i = 0, l = params.length; i < l; i++) {
    replacements[`${placeholderPrefix}_${i + 1}`] = params[i];
  }
  return replacements;
}

function sequelizeToSqlMetadata(Model: ModelStatic<any>): SqlEntityMetadata {
  return {
    toColumnName(fieldName) {
      const attribute = Model?.rawAttributes?.[fieldName];
      return attribute?.field ?? fieldName;
    },
    resolveRelation(relationName) {
      if (!hasOwn(Model.associations, relationName)) return;

      const association = Model.associations[relationName] as RuntimeAssociation;

      if (association.associationType === 'BelongsTo') {
        return {
          metadata: sequelizeToSqlMetadata(association.target),
          relatedTable: association.target.tableName,
          ownField: association.identifierField,
          relatedField: association.targetKeyField,
        };
      }

      if (association.associationType === 'HasOne' || association.associationType === 'HasMany') {
        return {
          metadata: sequelizeToSqlMetadata(association.target),
          relatedTable: association.target.tableName,
          ownField: association.sourceKeyField,
          relatedField: association.identifierField,
        };
      }

      if (association.associationType === 'BelongsToMany') {
        const throughTable = association.throughModel?.tableName
          ?? association.through.model.tableName;

        return {
          metadata: sequelizeToSqlMetadata(association.target),
          relatedTable: association.target.tableName,
          ownField: association.sourceKeyField,
          relatedField: association.targetKeyField,
          through: {
            table: throughTable,
            ownRelationField: association.identifierField,
            relatedRelationField: association.foreignIdentifierField
          }
        };
      }

      return undefined;
    }
  };
}

export interface SequelizeQueryOptions {
  alias?: string;
  replacementMode?: 'numeric' | 'named';
}

export const interpret = createSequelizeInterpreter(allInterpreters);

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
