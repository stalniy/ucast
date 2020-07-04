export interface Condition {
  readonly operator: string;
}

export class CompoundCondition implements Condition {
  public readonly conditions!: Condition[];
  public readonly operator!: string;

  constructor(operator: string, conditions: Condition[]) {
    this.operator = operator;

    if (!Array.isArray(conditions)) {
      throw new Error(`"${operator}" operator expects to receive an array of conditions`);
    }

    this.conditions = conditions;
  }

  add(conditions: Condition | Condition[]) {
    if (Array.isArray(conditions)) {
      this.conditions.push(...conditions);
    } else {
      this.conditions.push(conditions);
    }

    return this;
  }
}

export const ITSELF = '__itself__';
export class FieldCondition<T = unknown> implements Condition {
  public readonly operator!: string;
  public readonly field!: string | typeof ITSELF;
  public readonly value!: T;

  constructor(operator: string, field: string | typeof ITSELF, value: T) {
    this.operator = operator;
    this.field = field;
    this.value = value;
  }
}
