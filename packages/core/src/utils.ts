import { Condition, CompoundCondition } from './Condition';

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
