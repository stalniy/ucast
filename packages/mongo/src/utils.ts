import { Condition, CompoundCondition } from '@ucast/core';
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

export function isCompound(operator: string, condition: Condition): condition is CompoundCondition {
  return condition instanceof CompoundCondition && condition.operator === operator;
}

export function tryToSimplifyCompoundCondition<T extends Condition>(
  operator: string,
  conditions: T[]
) {
  if (conditions.length === 1) {
    return conditions[0];
  }

  let firstNode = conditions[0] as unknown as CompoundCondition<T>;

  if (isCompound(operator, firstNode)) {
    for (let i = 1, length = conditions.length; i < length; i++) {
      const currentNode = conditions[i];

      if (isCompound(operator, currentNode)) {
        firstNode = tryToSimplifyCompoundCondition(operator, [
          firstNode,
          ...currentNode.value
        ]) as CompoundCondition<T>;
      } else {
        firstNode.value.push(currentNode);
      }
    }

    return firstNode;
  }

  return new CompoundCondition(operator, conditions);
}
