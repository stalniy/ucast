import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';
import { RawBuilder, Model as ObjectionModel, QueryBuilder, QueryBuilderType, Relations } from 'objection';

type QueryBuilderMethod = keyof Pick<QueryBuilder<ObjectionModel>, 'where' | 'orWhere' | 'whereNot'>;
type WhereCallback = (builder: Query) => unknown;

export class Query {
  public query: QueryBuilder<ObjectionModel>;
  private _rootQuery: QueryBuilder<ObjectionModel>;
  private _method: QueryBuilderMethod;
  private _relations: Relations;
  private _fieldPrefix: string;

  constructor(
    query: QueryBuilder<ObjectionModel>,
    method: QueryBuilderMethod = 'where',
    rootQuery: QueryBuilder<ObjectionModel> = query,
    fieldPrefix: string = ''
  ) {
    this.query = query;
    this._method = method;
    this._rootQuery = rootQuery;
    this._relations = rootQuery.modelClass().getRelations();
    this._fieldPrefix = fieldPrefix;
  }

  private _tryToJoinRelation(field: string) {
    const relationNameIndex = field.indexOf('.');

    if (relationNameIndex !== -1) {
      const relationName = field.slice(0, relationNameIndex);

      if (this._relations[relationName]) {
        this._rootQuery.joinRelated(relationName);
      }
    }
  }

  private _applyTo(builder: QueryBuilder<ObjectionModel>): QueryBuilder<ObjectionModel> {
    return (this.query as any).toKnexQuery(builder);
  }

  where(field: string, operator: string, value?: any) {
    const possibleMethod = this._method + operator as QueryBuilderMethod;
    const fieldPrefixed = `${this._fieldPrefix}${field}`;

    this._tryToJoinRelation(fieldPrefixed);

    if (typeof this.query[possibleMethod] !== 'function') {
      this.query[this._method](fieldPrefixed, operator, value);
      return this;
    }

    if (typeof value === 'undefined') {
      this.query[possibleMethod as 'whereNull'](fieldPrefixed);
    } else {
      this.query[possibleMethod](fieldPrefixed, value);
    }

    return this;
  }

  whereWrapped(method: 'where' | 'orWhere', callback: WhereCallback, isInverted = false) {
    const tmpQuery = this.buildUsing(method, this.query.modelClass().query());
    const wrappingMethod = `${this._method}${isInverted ? 'Not' : ''}` as QueryBuilderMethod;

    callback(tmpQuery);
    this.query[wrappingMethod](builder => tmpQuery._applyTo(builder));

    return this;
  }

  whereRaw(field: string, sql: RawBuilder) {
    this._tryToJoinRelation(field);
    this.query[this._method](sql);
    return this;
  }

  buildUsing(method: QueryBuilderMethod, query: QueryBuilder<ObjectionModel> = this.query) {
    return new Query(query, method, this._rootQuery, this._fieldPrefix);
  }

  prefixed(fieldPrefix: string) {
    return new Query(this.query, this._method, this._rootQuery, `${fieldPrefix}.`);
  }
}

export type ObjectionOperator<C extends Condition> = <T extends ObjectionModel>(
  condition: C,
  query: Query,
  context: InterpretationContext<ObjectionOperator<C>>,
) => Query;

export function createObjectionInterpreter(operators: Record<string, ObjectionOperator<any>>) {
  const interpret = createInterpreter<ObjectionOperator<any>>(operators);
  return (condition: Condition, objectionQuery: QueryBuilderType<ObjectionModel>) => {
    return interpret(condition, new Query(objectionQuery)).query;
  };
}
