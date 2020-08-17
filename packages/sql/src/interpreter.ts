import {
  createInterpreter,
  Condition,
  InterpretationContext
} from '@ucast/core';

export interface SqlQueryOptions {
  rootAlias?: string
  regexp(field: string, placeholder: string, ignoreCase: boolean): string
  joinRelation(relationName: string, context: unknown): boolean
  escapeField(field: string): string
  paramPlaceholder(index: number): string
}

export class Query {
  public readonly options!: SqlQueryOptions;
  private _fieldPrefix!: string;
  private _params: unknown[] = [];
  private _sql: string[] = [];
  private _joins: string[] = [];
  private _lastPlaceholderIndex: number = 1;
  private _targetQuery!: unknown;
  private _rootAlias!: string;

  constructor(options: SqlQueryOptions, fieldPrefix: string = '', targetQuery?: unknown) {
    this.options = options;
    this._fieldPrefix = fieldPrefix;
    this._targetQuery = targetQuery;
    this._rootAlias = options.rootAlias ? `${options.escapeField(options.rootAlias)}.` : '';
  }

  field(rawName: string) {
    const name = this._fieldPrefix + rawName;
    const relationNameIndex = name.indexOf('.');

    if (relationNameIndex === -1) {
      return this._rootAlias + this.options.escapeField(name);
    }

    const relationName = name.slice(0, relationNameIndex);
    const field = name.slice(relationNameIndex + 1);

    if (!this.options.joinRelation(relationName, this._targetQuery)) {
      return this.options.escapeField(field);
    }

    this._joins.push(relationName);
    return `${this.options.escapeField(relationName)}.${this.options.escapeField(field)}`;
  }

  param() {
    return this.options.paramPlaceholder(this._lastPlaceholderIndex + this._params.length);
  }

  manyParams(items: unknown[]) {
    const startIndex = this._lastPlaceholderIndex + this._params.length;
    return items.map((_, i) => this.options.paramPlaceholder(startIndex + i));
  }

  child() {
    const query = new Query(this.options, this._fieldPrefix, this._targetQuery);
    query._lastPlaceholderIndex = this._lastPlaceholderIndex + this._params.length;
    return query;
  }

  where(field: string, operator: string, value?: unknown) {
    const sql = `${this.field(field)} ${operator} ${this.param()}`;
    return this.whereRaw(sql, value);
  }

  whereRaw(sql: string, ...values: unknown[]) {
    this._sql.push(sql);

    if (values) {
      this._params.push(...values);
    }

    return this;
  }

  merge(query: Query, operator: 'and' | 'or' = 'and', isInverted: boolean = false) {
    let sql = query._sql.join(` ${operator} `);

    if (sql[0] !== '(') {
      sql = `(${sql})`;
    }

    this._sql.push(`${isInverted ? 'not ' : ''}${sql}`);
    this._params.push(...query._params);
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
    return [this._sql.join(' and '), this._params, this._joins];
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
