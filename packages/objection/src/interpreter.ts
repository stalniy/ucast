import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';
import { Model as ObjectionModel, QueryBuilder, QueryBuilderType, Relations } from 'objection';

type QueryBuilderMethod = keyof QueryBuilder<ObjectionModel> & 'where' | 'orWhere' | 'whereNot';

export class Query {
  public query: QueryBuilder<ObjectionModel>;
  private _method: QueryBuilderMethod;
  private _relations: Relations;

  constructor(query: QueryBuilder<ObjectionModel>, method: QueryBuilderMethod = 'where') {
    this.query = query;
    this._method = method;
    this._relations = query.modelClass().getRelations();
  }

  where(field: string, operator: string, value: any) {
    const possibleMethod = this._method + operator as QueryBuilderMethod;

    if (field.includes('.')) {
      const [joinTable] = field.split('.');
      if (this._relations[joinTable]) {
        this.query.joinRelation(joinTable);
      }
    }
    if (typeof this.query[possibleMethod] === 'function') {
      this.query[possibleMethod](field, value);
    } else {
      this.query[this._method](field, operator, value);
    }

    return this;
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
