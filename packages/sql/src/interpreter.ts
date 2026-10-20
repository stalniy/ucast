import {
  Condition,
  type FieldCondition,
  type InterpreterOptions
} from '@ucast/core';
import { type DialectOptions } from './dialects.ts';

export function createSqlInterpreter<F = string, R = SqlStringComposerResult>(
  operators: Record<string, SqlOperator<any>>,
  options?: SqlInterpreterOptions<F, R>
) {
  const interpret = (condition: Condition, composer: SqlComposer<F>): F => {
    const name = options?.getInterpreterName
      ? options.getInterpreterName(condition, options)
      : condition.operator;
    const operator = operators[name] as SqlOperator<any, F>;
    if (typeof operator !== 'function') {
      throw new Error(`Unable to interpret "${String(name)}" condition. Did you forget to register interpreter for it?`);
    }
    return operator(condition, composer, { interpret });
  };
  const createSqlComposer = (options?.createSqlComposer ?? createDefaultSqlComposer) as Required<SqlInterpreterOptions<F, R>>['createSqlComposer'];

  return (condition: Condition, sqlOptions: SqlQueryOptions): R => {
    const composer = createSqlComposer(sqlOptions);
    const fragment = interpret(condition, composer);

    const result = typeof composer.result === 'function'
      ? composer.result(fragment)
      : fragment;

    return result as unknown as R;
  };
}

export interface SqlInterpreterOptions<F, R = F> {
  getInterpreterName?: InterpreterOptions['getInterpreterName'];
  createSqlComposer?(options: SqlQueryOptions): SqlComposition<F, R>;
}

export interface SqlComposer<F> {
  field(field: string): F;
  param(value: FieldCondition | unknown): F;
  manyParams(value: FieldCondition<unknown[]> | unknown[]): F;
  regexp: DialectOptions['regexp'];
  sql(strings: TemplateStringsArray, ...values: unknown[]): F;
  raw(sql: string): F;
  join(fragments: F[], separator: F): F;
  relation(name: string): RelationScope<F>;
}

export interface RelationScope<F> {
  composer: SqlComposer<F>;
  subquery(predicate: F, invertCondition?: boolean): F;
}

export interface SqlComposition<F, R = F> extends SqlComposer<F> {
  result?(fragment: F): R
}

export interface SqlQueryOptions extends Required<DialectOptions> {
  alias?: string;
  metadata?: SqlEntityMetadata;
}

export interface SqlEntityMetadata {
  toColumnName?(name: string): string;
  resolveRelation?(name: string): RelationMetadata | undefined;
}

export interface RelationMetadata {
  ownField: string;
  relatedField: string;
  relatedTable: string;
  metadata: SqlEntityMetadata;
}

export interface SqlInterpretationContext<F> {
  interpret(condition: Condition, composer: SqlComposer<F>): F;
}

const identity = <T>(x: T) => x;
const joinStrings = (fragments: readonly string[], separator: string) => fragments.join(separator);
const EMPTY_ARRAY = Object.freeze([]) as unknown as unknown[];
export function createDefaultSqlComposer(
  options: SqlQueryOptions,
  parent?: SqlComposer<string>
): SqlComposer<string> {
  let relationAliasIndex = 0;
  return createStringComposer(options, parent, name => `${name}_ucast${relationAliasIndex++}`);
}

function createStringComposer(
  options: SqlQueryOptions,
  parent: SqlComposer<string> | undefined,
  nextRelationAlias: (name: string) => string
): SqlComposer<string> {
  const params: unknown[] = parent ? EMPTY_ARRAY : [];
  const rootAlias = options.alias ? `${options.escapeIdentifier(options.alias)}.` : '';

  const composer: SqlComposition<string, SqlStringComposerResult> = {
    sql: joinTaggedStrings,
    raw: identity,
    field(name) {
      const columnName = typeof options.metadata?.toColumnName === 'function' ? options.metadata.toColumnName(name) : name;
      const escapedField = options.escapeIdentifier(columnName);
      return rootAlias ? rootAlias + escapedField : escapedField;
    },
    param: parent?.param ?? ((condition) => {
      if (condition instanceof Condition) {
        params.push(condition.value);
      } else {
        params.push(condition);
      }
      return options.paramPlaceholder(params.length);
    }),
    manyParams: parent?.manyParams ?? ((conditionOrValues) => {
      const values = conditionOrValues instanceof Condition ? conditionOrValues.value : conditionOrValues;
      let result = '';
      for (let i = 0, l = values.length; i < l; i++) {
        result += composer.param(values[i]);
        if (i < l - 1) result += ', ';
      }
      return result;
    }),
    join: joinStrings,
    regexp: options.regexp,
    relation(name) {
      const relation = options.metadata?.resolveRelation?.(name);
      if (!relation) {
        const alias = options.alias ? `${options.alias}.` : ''
        throw new Error(`Relation metadata for "${alias}${name}" not found`);
      }

      const relationAlias = nextRelationAlias(name);
      const relationComposer = createStringComposer({
        ...options,
        alias: relationAlias,
        metadata: relation.metadata,
      }, composer, nextRelationAlias);

      return {
        composer: relationComposer,
        subquery(predicate, invertCondition) {
          const condition = invertCondition ? `NOT (${predicate})` : `(${predicate})`;
          return `SELECT 1 FROM ${options.escapeIdentifier(relation.relatedTable)} as ${options.escapeIdentifier(relationAlias)} ` +
            `WHERE ${composer.field(relation.ownField)} = ${relationComposer.field(relation.relatedField)} AND ${condition}`;
        }
      };
    },
    result: (parent as SqlComposition<string, SqlStringComposerResult>)?.result ?? ((sql) => [sql, params])
  };

  return composer;
}
type SqlStringComposerResult = [sql: string, params: readonly unknown[]];

function joinTaggedStrings(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = '';
  for (let i = 0; i < strings.length; i++) {
    const value = i ? String(values[i - 1]) : '';
    result += value + strings[i];
  }
  return result;
}

export type SqlOperator<C extends Condition, F = unknown> = (
  condition: C,
  composer: SqlComposer<F>,
  context: SqlInterpretationContext<any>,
) => F;
