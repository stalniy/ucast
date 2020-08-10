import { Comparable } from '@ucast/core';

export interface MongoQueryTopLevelOperators<Value> {
  $and?: MongoQuery<Value>[],
  $or?: MongoQuery<Value>[],
  $nor?: MongoQuery<Value>[],
  $where?: (this: Value) => boolean
}

export interface MongoQueryFieldOperators<Value = any> {
  $eq?: Value,
  $ne?: Value,
  $lt?: Extract<Comparable, Value>,
  $lte?: Extract<Comparable, Value>,
  $gt?: Extract<Comparable, Value>,
  $gte?: Extract<Comparable, Value>,
  $in?: Value[],
  $nin?: Value[],
  $all?: Value[],
  /** checks by array length */
  $size?: number,
  $regex?: RegExp | string,
  $options?: 'i' | 'g' | 'm' | 'u',
  /** checks the shape of array item */
  $elemMatch?: MongoQuery<Value>,
  $exists?: boolean,
  $not?: Omit<MongoQueryFieldOperators<Value>, '$not'>,
}

export type MongoQueryOperators<Value = any> =
  MongoQueryFieldOperators<Value> & MongoQueryTopLevelOperators<Value>;

export interface CustomOperators {
  toplevel?: {}
  field?: {}
}

type ItemOf<T, AdditionalArrayTypes = never> = T extends any[]
  ? T[number] | AdditionalArrayTypes
  : T;
type OperatorValues<T> = null | T | Partial<ItemOf<T, []>> | MongoQueryFieldOperators<ItemOf<T>>;
type Query<T extends Record<PropertyKey, any>, FieldOperators> = {
  [K in keyof T]?: OperatorValues<T[K]> | FieldOperators
};

export interface DefaultOperators<T> {
  toplevel: MongoQueryTopLevelOperators<T>
  field: MongoQueryOperators<T>
}

export type BuildMongoQuery<
  T = Record<PropertyKey, any>,
  O extends CustomOperators = DefaultOperators<T>
> = T extends Record<PropertyKey, any>
  ? Query<T, O['field']> & O['toplevel']
  : O['field'] & O['toplevel'];

export type MongoQuery<T = Record<PropertyKey, any>, O extends CustomOperators = CustomOperators> =
  BuildMongoQuery<T, DefaultOperators<T> & O>;
