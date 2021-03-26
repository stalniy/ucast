import { Condition, CompoundCondition, NULL_CONDITION } from './Condition';

const hasOwnProperty = Object.prototype.hasOwnProperty.call.bind(Object.prototype.hasOwnProperty);

export function isCompound(operator: string, condition: Condition): condition is CompoundCondition {
  return condition instanceof CompoundCondition && condition.operator === operator;
}

function flattenConditions<T extends Condition>(
  operator: string,
  conditions: T[],
  aggregatedResult?: T[]
) {
  const flatConditions: T[] = aggregatedResult || [];

  for (let i = 0, length = conditions.length; i < length; i++) {
    const currentNode = conditions[i];

    if (isCompound(operator, currentNode)) {
      flattenConditions(operator, currentNode.value as T[], flatConditions);
    } else {
      flatConditions.push(currentNode);
    }
  }

  return flatConditions;
}

export function optimizedCompoundCondition<T extends Condition>(operator: string, conditions: T[]) {
  if (conditions.length === 1) {
    return conditions[0];
  }

  return new CompoundCondition(operator, flattenConditions(operator, conditions));
}

export const identity = <T>(x: T) => x;
export const object = () => Object.create(null);

export const ignoreValue: IgnoreValue = Object.defineProperty(object(), '__@type@__', {
  value: 'ignore value'
});
export interface IgnoreValue {
  readonly ['__@type@__']: 'ignore value'
}

export function hasOperators<T>(
  value: any,
  instructions: Record<string, unknown>,
  skipIgnore = false,
): value is T {
  if (!value || value && value.constructor !== Object) {
    return false;
  }

  for (const prop in value) { // eslint-disable-line no-restricted-syntax, guard-for-in
    const hasProp = hasOwnProperty(value, prop) && hasOwnProperty(instructions, prop);
    if (hasProp && (!skipIgnore || value[prop] !== ignoreValue)) {
      return true;
    }
  }

  return false;
}

export function objectKeysSkipIgnore(anyObject: Record<string, unknown>) {
  const keys: string[] = [];
  for (const key in anyObject) { // eslint-disable-line no-restricted-syntax
    if (hasOwnProperty(anyObject, key) && anyObject[key] !== ignoreValue) {
      keys.push(key);
    }
  }

  return keys;
}

export function pushIfNonNullCondition(conditions: Condition[], condition: Condition) {
  if (condition !== NULL_CONDITION) {
    conditions.push(condition);
  }
}
