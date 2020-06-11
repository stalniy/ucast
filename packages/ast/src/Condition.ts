export class Condition {
  protected _bool(name, conditions) {
    return new BoolCondition(name, [this].concat(conditions));
  }

  and(...conditions) {
    return this._bool('and', conditions);
  }

  or(...conditions) {
    return this._bool('or', conditions);
  }
}

export class BoolCondition extends Condition {
  public readonly name: string;
  public readonly conditions: Condition[];

  constructor(name, conditions) {
    super();
    this.name = name;
    this.conditions = conditions;
  }

  protected _bool(name, conditions) {
    if (name === this.name) {
      this.conditions.push(...conditions);
      return this;
    }

    return super._bool(name, conditions);
  }
}
