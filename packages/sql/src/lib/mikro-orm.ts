import { EntityMetadata } from '@mikro-orm/core';
import { type Condition } from '@ucast/core';
import {
  allInterpreters,
  createDialects,
  createSqlInterpreter,
  mysql,
  type SqlOperator
} from '../index';
import { splitRelationName } from './utils';

function joinRelation(relationPath: string, query: QueryBuilder) {
  let relationFullName = relationPath;
  const privateQuery = query as any;
  let meta = privateQuery.mainAlias.metadata as EntityMetadata;
  let alias = query.alias;

  while (relationFullName) {
    let relationName: string;
    [relationName, relationFullName] = splitRelationName(relationFullName);

    const relation = meta.properties[relationName];

    if (relation?.ref) {
      query.join(`${alias}.${relationName}`, relationName);

      if (!relation.targetMeta) {
        return false;
      }

      meta = relation.targetMeta;
      alias = relationName;
    } else {
      return false;
    }
  }

  return true;
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
