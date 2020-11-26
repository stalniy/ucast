import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';
import { DialectOptions } from './dialects';

export interface SqlQueryOptions extends Required<DialectOptions> {
  rootAlias?: string
  foreignField?(field: string, relationName: string): string
  localField?(field: string): string
}

type ChildOptions = Partial<Pick<
SqlQueryOptions,
'foreignField' | 'localField' | 'joinRelation'
>> & {
  linkParams?: boolean
};

export class Query {
  public readonly options!: SqlQueryOptions;
  private _fieldPrefix!: string;
  private _params: unknown[] = [];
  private _sql: string[] = [];
  private _joins = new Set<string>();
  private _lastPlaceholderIndex: number = 1;
  private _targetQuery!: unknown;
  private _rootAlias!: string;

  constructor(options: SqlQueryOptions, fieldPrefix: string = '', targetQuery?: unknown) {
    this.options = options;
    this._fieldPrefix = fieldPrefix;
    this._targetQuery = targetQuery;
    this._rootAlias = options.rootAlias ? `${options.escapeField(options.rootAlias)}.` : '';

    if (this.options.foreignField) {
      this.foreignField = this.options.foreignField;
    }

    if (this.options.localField) {
      this.localField = this.options.localField;
    }
  }

  field(rawName: string) {
    const name = this._fieldPrefix + rawName;
    const relationNameIndex = name.indexOf('.');

    if (relationNameIndex === -1) {
      return this._rootAlias + this.localField(name);
    }

    const relationName = name.slice(0, relationNameIndex);
    const field = name.slice(relationNameIndex + 1);

    if (!this.options.joinRelation(relationName, this._targetQuery)) {
      return this._rootAlias + this.localField(field);
    }

    this._joins.add(relationName);
    return this.foreignField(field, relationName);
  }

  private localField(field: string) {
    return this.options.escapeField(field);
  }

  private foreignField(field: string, relationName: string) {
    return `${this.options.escapeField(relationName)}.${this.options.escapeField(field)}`;
  }

  param(value: unknown) {
    const index = this._lastPlaceholderIndex + this._params.length;
    this._params.push(value);
    return this.options.paramPlaceholder(index);
  }

  manyParams(items: unknown[]) {
    return items.map(item => this.param(item));
  }

  child(options?: ChildOptions) {
    let queryOptions: SqlQueryOptions = this.options;
    let canLinkParams = false;

    if (options) {
      const { linkParams, ...overrideOptions } = options;
      queryOptions = { ...this.options, ...overrideOptions };
      canLinkParams = !!linkParams;
    }

    const query = new Query(queryOptions, this._fieldPrefix, this._targetQuery);

    if (canLinkParams) {
      query._params = this._params;
      query._joins = this._joins; // TODO: investigate case of referencing relations of relations
    } else {
      query._lastPlaceholderIndex = this._lastPlaceholderIndex + this._params.length;
    }
    return query;
  }

  where(field: string, operator: string, value: unknown) {
    return this.whereRaw(`${this.field(field)} ${operator} ${this.param(value)}`);
  }

  whereRaw(sql: string) {
    this._sql.push(sql);
    return this;
  }

  merge(query: Query, operator: 'and' | 'or' = 'and', isInverted: boolean = false) {
    let sql = query._sql.join(` ${operator} `);

    if (sql[0] !== '(') {
      sql = `(${sql})`;
    }

    this._sql.push(`${isInverted ? 'not ' : ''}${sql}`);

    if (this._params !== query._params) {
      this._params.push(...query._params);
      for (const relation of query._joins) { // eslint-disable-line
        this._joins.add(relation);
      }
    }
    return this;
  }

  usingFieldPrefix(prefix: string, callback: () => void) {
    const prevPrefix = this._fieldPrefix;

    try {
      this._fieldPrefix = `${prefix}.`;
      callback();
      return this;
    } finally {
      this._fieldPrefix = prevPrefix;
    }
  }

  toJSON(): [string, unknown[], string[]] {
    return [this._sql.join(' and '), this._params, Array.from(this._joins)];
  }
}

export type SqlOperator<C extends Condition> = (
  condition: C,
  query: Query,
  context: InterpretationContext<SqlOperator<C>>,
) => Query;

export function createSqlInterpreter(operators: Record<string, SqlOperator<any>>) {
  const interpret = createInterpreter<SqlOperator<any>>(operators);
  return (condition: Condition, options: SqlQueryOptions, targetQuery?: unknown) => {
    return interpret(condition, new Query(options, '', targetQuery)).toJSON();
  };
}
