import { MongoQueryOperators } from './types';

export const hasOwn = Object.hasOwn ||
  Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);

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
