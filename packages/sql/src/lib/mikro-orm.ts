import { Condition } from '@ucast/core';
import { QueryBuilder, AnyEntity, EntityMetadata } from 'mikro-orm';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  mysql
} from '../index';

function joinRelation<T extends AnyEntity<T>>(relationName: string, query: QueryBuilder<T>) {
  const privateQuery = query as any;
  const meta = privateQuery.metadata.get(privateQuery.entityName) as EntityMetadata<T>;
  const prop = meta.properties[relationName as keyof T & string];

  if (prop && prop.reference) {
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

  return <T extends AnyEntity<T>>(condition: Condition, query: QueryBuilder<T>) => {
    const dialect = (query as any).driver.config.get('type') as keyof typeof dialects;
    const options = dialects[dialect];

    if (!options) {
      throw new Error(`Unsupported database dialect: ${dialect}`);
    }

    const [sql, params] = interpretSQL(condition, options, query);
    return query.where(sql, params);
  };
}

export const interpret = createInterpreter(allInterpreters);
