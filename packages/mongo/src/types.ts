export interface MongoQueryTopLevelOperators<Value> {
  $and?: MongoQuery<Value>[],
  $or?: MongoQuery<Value>[],
  $nor?: MongoQuery<Value>[],
  $where?: (this: Value) => boolean
}

export interface MongoQueryFieldOperators<Value = any> {
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
  $regex?: RegExp | string,
  $options?: 'i' | 'g' | 'm' | 'u',
  $elemMatch?: MongoQuery<Value>,
  $exists?: boolean,
  $not?: Omit<MongoQueryFieldOperators<Value>, '$not'>,
};

export type MongoQueryOperators<Value = any> = MongoQueryFieldOperators<Value> & MongoQueryTopLevelOperators<Value>;

type ItemOf<T, AdditionalArrayTypes = never> = T extends any[] ? T[number] | AdditionalArrayTypes : T;
export type MongoQuery<T = Record<PropertyKey, any>> = T extends Record<PropertyKey, any>
  ? {
      [K in keyof T]?: null | Partial<ItemOf<T[K], T[K] | []>> | MongoQueryFieldOperators<ItemOf<T[K]>>
    } & MongoQueryTopLevelOperators<T>
  : MongoQueryOperators<T>;
