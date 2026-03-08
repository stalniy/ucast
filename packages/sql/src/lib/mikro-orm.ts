import { EntityMetadata } from '@mikro-orm/core';
import { type Condition } from '@ucast/core';
import {
  allInterpreters,
  createDialects,
  createSqlInterpreter,
  mysql,
  type SqlOperator
} from '../index';

function joinRelation(relationName: string, query: QueryBuilder) {
  const privateQuery = query as any;
  const meta = privateQuery.mainAlias.metadata as EntityMetadata;
  const prop = meta.properties[relationName];

  if (prop?.ref) {
    query.join(`${query.alias}.${relationName}`, relationName);
    return true;
  }

  return false;
}

const dialects = createDialects({
  joinRelation,
  paramPlaceholder: mysql.paramPlaceholder,
});

export function createInterpreter(interpreters: Record<string, SqlOperator<any>>) {
  const interpretSQL = createSqlInterpreter(interpreters);

  return <T extends QueryBuilder>(condition: Condition, query: T) => {
    const platformName = (query as any).platform.constructor.name;
    const dialect = platformName.slice(0, platformName.indexOf('Platform')).toLowerCase() as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, options, query);
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);

interface QueryBuilder {
  alias: string;
  join(path: string, alias: string): this;
  where(sql: string, params?: unknown[]): this;
}
