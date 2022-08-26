import {
  createInterpreter,
  Condition,
  InterpretationContext,
  InterpreterOptions
} from '@ucast/core';
import { DialectOptions } from './dialects';

export interface SqlQueryOptions extends Required<DialectOptions> {
  rootAlias?: string
  foreignField?(field: string, relationName: string): string
  localField?(field: string): string
  joinRelation?(relationName: string, context: unknown): boolean
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
  private _relationContext!: unknown;
  private _rootAlias!: string;

  constructor(options: SqlQueryOptions, fieldPrefix: string = '', relationContext?: unknown) {
    this.options = options;
    this._fieldPrefix = fieldPrefix;
    this._relationContext = relationContext;
    this._rootAlias = options.rootAlias ? `${options.escapeField(options.rootAlias)}.` : '';

    if (this.options.foreignField) {
      this._foreignField = this.options.foreignField;
    }

    if (this.options.localField) {
      this._localField = this.options.localField;
    }
  }

  field(rawName: string) {
    const name = this._fieldPrefix + rawName;

    if (!this.options.joinRelation) {
      return this._rootAlias + this._localField(name);
    }

    const relationNameIndex = name.lastIndexOf('.');

    if (relationNameIndex === -1) {
      return this._rootAlias + this._localField(name);
    }

    const relationName = name.slice(0, relationNameIndex);
    const field = name.slice(relationNameIndex + 1);

    if (!this.options.joinRelation(relationName, this._relationContext)) {
      return this._rootAlias + this._localField(name);
    }

    relationName.split('.').forEach(r => this._joins.add(r));

    return this._foreignField(field, relationName);
  }

  private _localField(field: string) {
    return this.options.escapeField(field);
  }

  private _foreignField(field: string, relationName: string) {
    const relationLastAlias = relationName.split('.').slice(-1)[0];
    return `${this.options.escapeField(relationLastAlias)}.${this.options.escapeField(field)}`;
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

    const query = new Query(queryOptions, this._fieldPrefix, this._relationContext);

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
    const sql = query._sql.join(` ${operator} `);

    this._sql.push(`${isInverted ? 'not ' : ''}(${sql})`);

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

interface SqlInterpreterOptions {
  getInterpreterName?: InterpreterOptions['getInterpreterName']
}

export function createSqlInterpreter(
  operators: Record<string, SqlOperator<any>>,
  options?: SqlInterpreterOptions
) {
  const interpret = createInterpreter<SqlOperator<any>>(operators, options);
  return (condition: Condition, sqlOptions: SqlQueryOptions, relationContext?: unknown) => {
    return interpret(condition, new Query(sqlOptions, '', relationContext)).toJSON();
  };
}
