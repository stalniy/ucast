import {
  createInterpreter,
  type Condition,
  type InterpretationContext,
  type InterpreterOptions
} from '@ucast/core';
import { type DialectOptions } from './dialects.ts';

export interface SqlQueryOptions extends Required<DialectOptions> {
  rootAlias?: string;
  localField?(field: string): string;
  getRelationMetadata?(
    relationName: string,
    helpers: RelationMetadataHelpers
  ): RelationMetadata | undefined;
}

export interface RelationMetadataHelpers {
  escape(field: string): string;
  relationContext: unknown;
}

export type RelationMetadata = SimpleRelationMetadata | CustomRelationMetadata;

export interface SimpleRelationMetadata {
  parentField: string;
  relationField: string;
  relationTable: string;
  relationContext?: unknown;
}

export interface CustomRelationMetadata {
  relationContext?: unknown;
  buildRelationQuery(context: RelationQueryContext): string;
}

export interface RelationQueryContext {
  relationName: string;
  parentAlias?: string;
  relationAlias: string;
  escapeField(field: string): string;
  parentField(field: string): string;
  relationField(field: string): string;
  conditionSql(): string;
  param(value: unknown): string;
}

type ChildOptions = Partial<Pick<
SqlQueryOptions,
'localField' | 'getRelationMetadata' | 'rootAlias'
>> & {
  linkParams?: boolean;
  relationContext?: unknown;
};

export class Query {
  public readonly options!: SqlQueryOptions;
  private _fieldPrefix!: string;
  private _params: unknown[] = [];
  private _sql: string[] = [];
  private _lastPlaceholderIndex = 1;
  private _relationCounter = { value: 0 };
  public readonly relationContext!: unknown;
  public readonly rootAlias?: string;
  private _rootAlias!: string;

  constructor(options: SqlQueryOptions, fieldPrefix = '', relationContext?: unknown) {
    this.options = options;
    this._fieldPrefix = fieldPrefix;
    this.relationContext = relationContext;
    this.rootAlias = options.rootAlias;
    this._rootAlias = options.rootAlias ? `${options.escapeField(options.rootAlias)}.` : '';

    if (this.options.localField) {
      this._localField = this.options.localField;
    }
  }

  field(rawName: string) {
    const name = this._fieldPrefix + rawName;
    return this._rootAlias + this._localField(name);
  }

  rootField(name: string) {
    return this._rootAlias + this._localField(name);
  }

  private _localField(field: string) {
    return this.options.escapeField(field);
  }

  param(value: unknown) {
    const index = this._lastPlaceholderIndex + this._params.length;
    this._params.push(value);
    return this.options.paramPlaceholder(index);
  }

  manyParams(items: unknown[]) {
    return items.map(item => this.param(item));
  }

  nextRelationAlias(prefix: string) {
    return `${prefix}_${this._relationCounter.value++}`;
  }

  child(options?: ChildOptions) {
    let queryOptions: SqlQueryOptions = this.options;
    let canLinkParams = false;

    if (options) {
      const { linkParams, ...overrideOptions } = options;
      queryOptions = { ...this.options, ...overrideOptions };
      canLinkParams = !!linkParams;
    }

    const relationContext = options?.relationContext ?? this.relationContext;
    const query = new Query(queryOptions, this._fieldPrefix, relationContext);
    query._relationCounter = this._relationCounter;

    if (canLinkParams) {
      query._params = this._params;
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

  merge(query: Query, operator: 'and' | 'or' = 'and', isInverted = false) {
    const sql = query._sql.join(` ${operator} `);

    this._sql.push(`${isInverted ? 'not ' : ''}(${sql})`);

    if (this._params !== query._params) {
      this._params.push(...query._params);
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

  toJSON(): [string, unknown[]] {
    return [this._sql.join(' and '), this._params];
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
