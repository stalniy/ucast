import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';
import { Model as ObjectionModel, QueryBuilder, QueryBuilderType } from 'objection';

type QueryBuilderMethod = keyof QueryBuilder<ObjectionModel> & 'where' | 'orWhere' | 'whereNot';

export class Query {
  public query: QueryBuilder<ObjectionModel>;
  private _method: QueryBuilderMethod;

  constructor(query: QueryBuilder<ObjectionModel>, method: QueryBuilderMethod = 'where') {
    this.query = query;
    this._method = method;
  }

  where(field: string, operator: string, value: any) {
    const possibleMethod = this._method + operator as QueryBuilderMethod;

    // TODO: implement joins if field has dot inside
    //       otherwise add where condition over JSON field if field is of JSON data type

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
