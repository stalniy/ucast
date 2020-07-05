import { JsInterpretationOptions } from './interpreter';

export type AnyObject = Record<PropertyKey, unknown>;
export type GetField = (object: any, field: string) => any;

export function includes<T>(items: T[], value: T, equal: JsInterpretationOptions['equal']): boolean {
  for (let i = 0, length = items.length; i < length; i++) {
    if (equal(items[i], value)) {
      return true;
    }
  }

  return false;
}


function getField<T extends AnyObject>(object: T | T[], field: string, get: GetField) {
  return Array.isArray(object) ? object.map(item => get(item, field)) : get(object, field);
}

export function getValueByPath(object: AnyObject, field: string, get: GetField) {
  if (field.indexOf('.') === -1) {
    return getField(object, field, get);
  }

  const paths = field.split('.');
  let value = object;

  for (let i = 0, length = paths.length; i < length; i++) {
    value = getField(value, paths[i], get);

    if (!value || typeof value !== 'object') {
      return value;
    }
  }

  return value;
}
