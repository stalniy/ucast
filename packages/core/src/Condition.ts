export interface Condition {
  readonly operator: string;
  readonly value: unknown;
}

export class DocumentCondition<T> implements Condition {
  public readonly operator!: string;

  public readonly value!: T;

  constructor(operator: string, value: T) {
    this.operator = operator;
    this.value = value;
  }
}

export class CompoundCondition<T extends Condition = Condition> extends DocumentCondition<T[]> {
  public readonly operator!: string;

  constructor(operator: string, conditions: T[]) {
    if (!Array.isArray(conditions)) {
      throw new Error(`"${operator}" operator expects to receive an array of conditions`);
    }

    super(operator, conditions);
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

export const NULL_CONDITION = new DocumentCondition('__null__', null);
