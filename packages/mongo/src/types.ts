import { Comparable } from '@ucast/core';

export interface MongoQueryTopLevelOperators<Value> {
  $and?: MongoQuery<Value>[],
  $or?: MongoQuery<Value>[],
  $nor?: MongoQuery<Value>[],
  $where?: (this: Value) => boolean
}

export interface MongoQueryFieldOperators<Value = any> {
  $eq?: FieldOperatorValue<Value>,
  $ne?: FieldOperatorValue<Value>,
  $lt?: ComparableValue<Value>,
  $lte?: ComparableValue<Value>,
  $gt?: ComparableValue<Value>,
  $gte?: ComparableValue<Value>,
  $in?: MembershipValue<Value>[],
  $nin?: MembershipValue<Value>[],
  $all?: ItemOf<Value>[],
  /** checks by array length */
  $size?: ArrayFieldValue<Value, number>,
  $regex?: RegexValue<Value>,
  $options?: RegexOptions<Value>,
  /** checks the shape of array item */
  $elemMatch?: ArrayFieldValue<Value, MongoQuery<ItemOf<Value>>>,
  $exists?: boolean,
  $mod?: NumericFieldValue<Value, [number, number]>,
  $not?: FieldNotOperator<Value>,
}

export type MongoQueryOperators<Value = any> =
  MongoQueryFieldOperators<Value> & MongoQueryTopLevelOperators<Value>;

export interface CustomOperators {
  toplevel?: {}
  field?: {}
}

type ItemOf<T> = T extends readonly unknown[]
  ? T[number]
  : T;

type FieldOperatorValue<T> = T extends readonly unknown[] ? ItemOf<T> | T : T;
type ComparableValue<T> = Extract<Comparable, ItemOf<T>>;
type NumericFieldValue<T, V> = Extract<ItemOf<T>, number> extends never ? never : V;
type StringFieldValue<T, V> = Extract<ItemOf<T>, string> extends never ? never : V;
type ArrayFieldValue<T, V> = T extends readonly unknown[] ? V : never;
type RegexValue<T> = StringFieldValue<T, RegExp | string>;
type MembershipValue<T> = ItemOf<T> | StringFieldValue<T, RegExp>;
type RegExpOption = 'i' | 'm' | 's' | 'u';
type RegExpOptions =
  RegExpOption
  | `${RegExpOption}${RegExpOption}`
  | `${RegExpOption}${RegExpOption}${RegExpOption}`
  | `${RegExpOption}${RegExpOption}${RegExpOption}${RegExpOption}`;
type RegexOptions<T> = StringFieldValue<T, RegExpOptions>;
type FieldNotOperator<T> = Omit<MongoQueryFieldOperators<T>, '$not'> | StringFieldValue<T, RegExp>;
type OperatorValues<T> =
  null | T | Partial<ItemOf<T> | []> | MongoQueryFieldOperators<T>;
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
