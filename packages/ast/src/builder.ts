import { Condition, BoolCondition } from './Condition';
import { FieldCondition } from './FieldCondition';

export function where(field, value) {
  return new FieldCondition(field, value);
}

function createBoolOperator(name) {
  return (...conditions) => new BoolCondition(name, conditions);
}

export const or = createBoolOperator('or');
export const and = createBoolOperator('and');