import { type Condition } from '@ucast/core';
import { raw, type Model, type ModelClass } from 'objection';
import {
  createSqlInterpreter,
  allInterpreters,
  type SqlOperator,
  createDialects,
  mysql,
  type SqlEntityMetadata,
  type RelationMetadata,
  type SqlInterpreterOptions,
  type SqlStringComposerResult,
} from '../index.ts';

export interface ObjectionInterpreterOptions
  extends SqlInterpreterOptions<string, SqlStringComposerResult> {
}

export interface ObjectionQueryOptions {
  alias?: string;
}

export function createObjectionInterpreter(
  interpreters: Record<string, SqlOperator<any>>,
  objectionOptions: ObjectionInterpreterOptions = {},
) {
  const interpretSQL = createSqlInterpreter(interpreters, objectionOptions);
  const dialects = createDialects({ paramPlaceholder: mysql.paramPlaceholder });

  return <T extends Model>(
    condition: Condition, Model: ModelClass<T>, queryOptions?: ObjectionQueryOptions,
  ) => {
    const dialect = Model.knex().client.config.client as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error('Unsupported database dialect');
    }

    const [sql, params] = interpretSQL(condition, {
      ...options,
      alias: queryOptions?.alias ?? Model.tableName,
      metadata: objectionToSqlMetadata(Model),
    });
    return raw(sql, params);
  };
}

export const interpret = createObjectionInterpreter(allInterpreters);

export function objectionToSqlMetadata(Model: ModelClass<Model>): SqlEntityMetadata {
  return new ObjectionSqlMetadata(Model);
}

class ObjectionSqlMetadata implements SqlEntityMetadata {
  private readonly _Model: ModelClass<Model>;

  constructor(Model: ModelClass<Model>) {
    this._Model = Model;
  }

  toColumnName(field: string): string {
    const Model = this._Model;
    if (typeof Model?.propertyNameToColumnName !== 'function') return field;
    const model = new Model() as Model & { $formatDatabaseJson(json: object): object };
    const existingColumns = Object.keys(model.$formatDatabaseJson({}));
    const mappedColumns = Object.keys(model.$formatDatabaseJson({ [field]: null }))
      .filter(column => !existingColumns.includes(column));
    if (mappedColumns.length > 1) {
      throw new Error(`Property "${field}" maps to multiple database columns, which is not supported`);
    }
    return Model.propertyNameToColumnName(field);
  }

  resolveRelation(relationName: string): RelationMetadata | undefined {
    const mappings = typeof this._Model.relationMappings === 'function'
      ? this._Model.relationMappings()
      : this._Model.relationMappings;
    if (!hasOwn(mappings, relationName)) {
      return undefined;
    }
    const relation = this._Model.getRelation(relationName) as unknown as RuntimeRelation;
    const metadata: RelationMetadata = {
      metadata: objectionToSqlMetadata(relation.relatedModelClass),
      relatedTable: relation.relatedModelClass.tableName,
      ownField: relation.ownerProp.cols,
      relatedField: relation.relatedProp.cols,
    };

    if (relation.joinTable) {
      metadata.through = {
        table: relation.joinTable,
        ownRelationField: relation.joinTableOwnerProp.cols,
        relatedRelationField: relation.joinTableRelatedProp.cols,
      };
    }

    return metadata;
  }
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

const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));
