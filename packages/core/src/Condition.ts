export interface Condition {
  readonly operator: string;
  readonly value: unknown;
}

export class ValueCondition<T> implements Condition {
  public readonly operator!: string;
  public readonly value!: T;

  constructor(operator: string, value: T) {
    this.operator = operator;
    this.value = value;
  }
}

export class CompoundCondition extends ValueCondition<Condition[]> {
  public readonly operator!: string;

  constructor(operator: string, conditions: Condition[]) {
    if (!Array.isArray(conditions)) {
      throw new Error(`"${operator}" operator expects to receive an array of conditions`);
    }

    super(operator, conditions)
  }

  add(conditions: Condition | Condition[]) {
    if (Array.isArray(conditions)) {
      this.value.push(...conditions);
    } else {
      this.value.push(conditions);
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
