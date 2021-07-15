export interface Note<T> {
  type: string
  message?: string
  originalValue?: T
}

export abstract class Condition<T = unknown> {
  private _notes!: Note<T>[];

  constructor(
    public readonly operator: string,
    public readonly value: T
  ) {
    Object.defineProperty(this, '_notes', {
      writable: true
    });
  }

  get notes(): ReadonlyArray<Note<T>> | undefined {
    return this._notes;
  }

  addNote(note: Note<T>) {
    this._notes = this._notes || [];
    this._notes.push(note);
  }
}

export class DocumentCondition<T> extends Condition<T> {
}

export class CompoundCondition<T extends Condition = Condition> extends DocumentCondition<T[]> {
  constructor(operator: string, conditions: T[]) {
    if (!Array.isArray(conditions)) {
      throw new Error(`"${operator}" operator expects to receive an array of conditions`);
    }

    super(operator, conditions);
  }
}

export const ITSELF = '__itself__';
export class FieldCondition<T = unknown> extends Condition<T> {
  public readonly field!: string | typeof ITSELF;

  constructor(operator: string, field: string | typeof ITSELF, value: T) {
    super(operator, value);
    this.field = field;
  }
}

export const NULL_CONDITION = new DocumentCondition('__null__', null);
export type ConditionValue<T> = T extends Condition<infer V> ? V : unknown;
