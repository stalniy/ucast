import {
  type Condition,
  type InterpreterOptions
} from '@ucast/core';
import { type DialectOptions } from './dialects.ts';

export type SqlTag<F> = (strings: TemplateStringsArray, ...values: unknown[]) => F;

/** One backend instance owns fragments and bound values for one interpretation. */
export interface SqlBackend<F, R> extends FragmentHelpers<F> {
  result(fragment: F): R;
  regexp(field: F, value: F, ignoreCase: boolean): F;
}

export type SqlBackendFactory<F, R> = () => SqlBackend<F, R>;

export interface SqlQueryOptions<F = string>
  extends Required<DialectOptions> {
  rootAlias?: string;
  /** Returns an escaped local column fragment; Query adds the current alias. */
  localField?(field: string, helpers: RelationMetadataHelpers): string;
  getRelationMetadata?(
    relationName: string,
    helpers: RelationMetadataHelpers
  ): RelationMetadata<F> | undefined;
}

export interface RelationMetadataHelpers {
  escape(field: string): string;
  relationContext: unknown;
}

export type RelationMetadata<F = string> = SimpleRelationMetadata | CustomRelationMetadata<F>;

export interface SimpleRelationMetadata {
  parentField: string;
  relationField: string;
  relationTable: string;
  relationContext?: unknown;
}

export interface CustomRelationMetadata<F = string> {
  relationContext?: unknown;
  buildRelationQuery(context: RelationQueryContext<F>): F;
}

export interface FragmentHelpers<F> {
  sql: SqlTag<F>;
  raw(text: string): F;
  param(value: unknown): F;
  manyParams(items: unknown[]): F;
  join(fragments: readonly F[], separator: string): F;
  regexp(field: F, value: F, ignoreCase: boolean): F;
}

export interface SqlInterpretationContext<F = string, R = [string, unknown[]]>
  extends FragmentHelpers<F> {
  interpret(condition: Condition, query: Query<F, R>): Query<F, R>;
}

export interface RelationQueryContext<F = string> extends FragmentHelpers<F> {
  relationName: string;
  parentAlias?: string;
  relationAlias: string;
  escapeIdentifier(name: string): F;
  parentField(field: string): F;
  relationField(field: string): F;
  conditionSql(): F;
}

type ChildOptions<F> = Partial<Pick<
  SqlQueryOptions<F>,
  'localField' | 'getRelationMetadata' | 'rootAlias'
>> & {
  relationContext?: unknown;
};

const identity = <T>(x: T) => x;
const joinStrings = (fragments: readonly string[], separator: string) => fragments.join(separator);
export function createDefaultSqlBackend(
  options: Required<DialectOptions>
): SqlBackend<string, [string, unknown[]]> {
  const params: unknown[] = [];
  const param = (value: unknown) => {
    params.push(value);
    return options.paramPlaceholder(params.length);
  };
  return {
    sql: joinTaggedStrings,
    raw: identity,
    param,
    manyParams: items => items.map(param).join(', '),
    join: joinStrings,
    regexp: options.regexp,
    result: fragment => [fragment, params],
  };
}

function joinTaggedStrings(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    const value = i ? String(values[i - 1]) : '';
    result += value + strings[i];
  }
  return result;
}

export class Query<F = string, R = [string, unknown[]]> {
  public readonly options: SqlQueryOptions<F>;
  public readonly backend: SqlBackend<F, R>;
  private _fieldPrefix: string;
  private _fragments: F[] = [];
  private _relationCounter = { value: 0 };
  public readonly relationContext: unknown;
  public readonly rootAlias?: string;

  constructor(
    options: SqlQueryOptions<F>, backend: SqlBackend<F, R>,
    fieldPrefix = '', relationContext?: unknown
  ) {
    this.options = options;
    this._fieldPrefix = fieldPrefix;
    this.relationContext = relationContext;
    this.rootAlias = options.rootAlias;
    this.backend = backend;
  }

  field(rawName: string): F {
    return this.rootField(this._fieldPrefix + rawName);
  }

  rootField(name: string): F {
    const helpers = {
      escape: this.options.escapeIdentifier,
      relationContext: this.relationContext,
    };
    const local = this.options.localField
      ? this.options.localField(name, helpers)
      : this.options.escapeIdentifier(name);
    const qualified = (this.rootAlias ? `${this.options.escapeIdentifier(this.rootAlias)}.` : '') + local;
    return this.backend.raw(qualified);
  }

  nextRelationAlias(prefix: string) {
    return `${prefix}_${this._relationCounter.value++}`;
  }

  child(options?: ChildOptions<F>) {
    let queryOptions = this.options;
    if (options) {
      const { ...overrideOptions } = options;
      delete overrideOptions.relationContext;
      queryOptions = { ...this.options, ...overrideOptions };
    }
    const relationContext = options?.relationContext ?? this.relationContext;
    const query = new Query(queryOptions, this.backend, this._fieldPrefix, relationContext);
    query._relationCounter = this._relationCounter;
    return query;
  }

  where(fragment: F) {
    this._fragments.push(fragment);
    return this;
  }

  fragment(): F {
    return this.backend.join(this._fragments, ' and ');
  }

  merge(query: Query<F, R>, operator: 'and' | 'or' = 'and', isInverted = false) {
    const fragment = this.backend.join(query._fragments, ` ${operator} `);
    const inverted = this.backend.raw(isInverted ? 'not ' : '');
    this._fragments.push(this.backend.sql`${inverted}(${fragment})`);
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
}

export type SqlOperator<C extends Condition> = (
  condition: C,
  query: Query<any, any>,
  context: SqlInterpretationContext<any, any>,
) => Query<any, any>;

interface SqlInterpreterOptions<F, R> {
  backend?: SqlBackendFactory<F, R>;
  getInterpreterName?: InterpreterOptions['getInterpreterName'];
}

export function createSqlInterpreter<F = string, R = [string, unknown[]]>(
  operators: Record<string, SqlOperator<any>>,
  options?: SqlInterpreterOptions<F, R>
) {
  const interpret = (condition: Condition, query: Query<F, R>): Query<F, R> => {
    const name = options?.getInterpreterName
      ? options.getInterpreterName(condition, options)
      : condition.operator;
    const operator = operators[name];
    if (typeof operator !== 'function') {
      throw new Error(`Unable to interpret "${String(name)}" condition. Did you forget to register interpreter for it?`);
    }
    const { sql, raw, param, manyParams, join, regexp } = query.backend;
    const context = { sql, raw, param, manyParams, join, regexp, interpret };
    return operator(condition, query, context);
  };
  const createSqlBackend = options?.backend ?? createDefaultSqlBackend;

  return (
    condition: Condition, sqlOptions: SqlQueryOptions<F>, relationContext?: unknown
  ): R => {
    const backend = createSqlBackend(sqlOptions) as SqlBackend<F, R>;
    const query = new Query(sqlOptions, backend, '', relationContext);
    return backend.result(interpret(condition, query).fragment());
  };
}
