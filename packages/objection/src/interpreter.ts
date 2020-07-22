import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';
import { raw, Model as ObjectionModel, QueryBuilder, QueryBuilderType, Relations } from 'objection';

type QueryBuilderMethod = keyof Pick<QueryBuilder<ObjectionModel>, 'where' | 'orWhere' | 'whereNot' | 'whereRaw'>;

export class Query {
  public query: QueryBuilder<ObjectionModel>;
  private _rootQuery: QueryBuilder<ObjectionModel>;
  private _method: QueryBuilderMethod;
  private _relations: Relations;

  constructor(
    query: QueryBuilder<ObjectionModel>,
    method: QueryBuilderMethod = 'where',
    rootQuery: QueryBuilder<ObjectionModel> = query
  ) {
    this.query = query;
    this._method = method;
    this._rootQuery = rootQuery;
    this._relations = rootQuery.modelClass().getRelations();
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

  where(field: string, operator: string, value: any) {
    const possibleMethod = this._method + operator as QueryBuilderMethod;

    this._tryToJoinRelation(field);

    if (typeof this.query[possibleMethod] === 'function') {
      this.query[possibleMethod](field, value);
    } else {
      this.query[this._method](field, operator, value);
    }

    return this;
  }

  whereRaw(field: string, sql: string, bindings?: any) {
    this._tryToJoinRelation(field);
    this.query[this._method](raw(sql, bindings) as any);
    return this;
  }

  buildUsing(method: QueryBuilderMethod, query: QueryBuilder<ObjectionModel> = this.query) {
    return new Query(query, method, this._rootQuery);
  }

  applyTo(builder: QueryBuilder<ObjectionModel>): QueryBuilder<ObjectionModel> {
    return (this.query as any).toKnexQuery(builder);
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
