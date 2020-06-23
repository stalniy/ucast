export class Condition {
  public readonly operator: string;

  constructor(operator: string) {
    this.operator = operator;
  }
}

interface CompoundConditionOptions {
  maxItems?: number
}

export class CompoundCondition extends Condition {
  public readonly conditions: Condition[];

  constructor(operator: string, conditions: Condition[], options?: CompoundConditionOptions) {
    super(operator);

    if (!Array.isArray(conditions)) {
      throw new Error(`"${operator}" operator expects to receive an array of conditions`);
    }

    if (options && options.maxItems && conditions.length > options.maxItems) {
      throw new Error(`"${operator}" operator accepts only ${options.maxItems} condition(s)`);
    }

    this.conditions = conditions;
  }

  merge(conditions: Condition | Condition[]) {
    if (Array.isArray(conditions)) {
      this.conditions.push(...conditions);
    } else {
      this.conditions.push(conditions);
    }

    return this;
  }
}

export class FieldCondition<T = unknown> extends Condition {
  public readonly field: string;
  public readonly value: T;

  constructor(operator: string, field: string, value: T) {
    super(operator);
    this.field = field;
    this.value = value;
  }
}
