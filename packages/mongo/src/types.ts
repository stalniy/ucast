import { Condition } from '@muast/ast';

type RegExpOptions<T> = { $regex: T, $options?: string };

export type MongoQueryOperators<Value = any> = {
  $eq?: Value,
  $ne?: Value,
  $lt?: string | number | Date,
  $lte?: string | number | Date,
  $gt?: string | number | Date,
  $gte?: string | number | Date,
  $in?: Value[],
  $nin?: Value[],
  $all?: Value[],
  $size?: number,
  $regex?: RegExp | RegExpOptions<string> | RegExpOptions<RegExp>,
  $elemMatch?: MongoQueryOperators<Value> | Record<string, MongoQueryOperators<Value>>,
  $exists?: boolean,
  $and?: MongoQuery[],
  $or?: MongoQuery[],
  $not?: MongoQuery,
  $nor?: MongoQuery[],
};

export type MongoQuery<T = Record<PropertyKey, any>> = T extends Record<PropertyKey, any>
  ? { [k in keyof T]: MongoQueryOperators<T[k]> }
  : MongoQueryOperators<T>

export type Comparable = number | string | Date;
