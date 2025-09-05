import { Condition } from '@ucast/core';
import { QueryBuilder, AnyEntity, EntityMetadata } from '@mikro-orm/knex';
import {
  createSqlInterpreter,
  allInterpreters,
  SqlOperator,
  createDialects,
  mysql
} from '../index';
import { splitRelationName } from './utils';

function joinRelation<T extends AnyEntity<T>>(input: string, query: QueryBuilder<T>) {
  let relationFullName : string | undefined = input;
  const privateQuery = query as any;

  let meta = privateQuery.metadata.get(privateQuery.entityName) as EntityMetadata;
  let alias : string | undefined = query.alias;

  while (relationFullName) {
    let relationName: string;
    [relationName, relationFullName] = splitRelationName(relationFullName);

    const relation = meta.properties[relationName];

    if (relation) {
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
