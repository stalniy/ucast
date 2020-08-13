import { MongoQueryOperators } from './types';

export function hasOperators(value: any): value is MongoQueryOperators {
  if (!value || value && value.constructor !== Object) {
    return false;
  }

  for (const prop in value) { // eslint-disable-line no-restricted-syntax
    if (value.hasOwnProperty(prop) && prop[0] === '$') {
      return true;
    }
  }

  return false;
}
