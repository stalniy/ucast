import { MongoQueryOperators } from './types';

export const hasOwn: (object: object, key: PropertyKey) => boolean = (Object as {
  hasOwn?: (object: object, key: PropertyKey) => boolean
}).hasOwn || ((object, key) => Object.prototype.hasOwnProperty.call(object, key));

export function hasOperators(value: any): value is MongoQueryOperators {
  if (!value || value && value.constructor !== Object) {
    return false;
  }

  for (const prop in value) {  
    if (hasOwn(value, prop) && prop[0] === '$') {
      return true;
    }
  }

  return false;
}
