import { Condition, FieldCondition, CompoundCondition } from '@ucast/core';

export function renameFields(condition: Condition, prepend: string): Condition {
  if (Array.isArray(condition.value)) {
    const conditions = condition.value.map(c => renameFields(c, prepend));
    return new CompoundCondition(condition.operator, conditions);
  }
  if (condition.hasOwnProperty('field')) {
    const fieldCondition = condition as FieldCondition;
    return new FieldCondition(
      fieldCondition.operator,
      `${prepend}.${fieldCondition.field}`,
      fieldCondition.value
    );
  }

  return condition;
}
