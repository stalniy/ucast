import { Condition } from './Condition';

export class FieldCondition extends Condition {
  public readonly field: string;
  public inverted: boolean;
  public name: string;
  public value?: any;

  constructor(field, value = undefined) {
    super();
    this.field = field;
    this.inverted = false;
    this.name = '=';
    this.value = value;
  }

  _where(op, value = undefined) {
    this.name = op;
    this.value = value
    return this;
  }

  not() {
    this.inverted = true;
    return this;
  }

  eq(value) {
    return this._where('=', value);
  }

  lt(value) {
    return this._where('<', value);
  }

  lte(value) {
    return this._where('<=', value);
  }

  gt(value) {
    return this._where('>', value);
  }

  gte(value) {
    return this._where('>=', value);
  }

  in(value) {
    return this._where('in', value);
  }

  isNull() {
    return this._where('isNull');
  }

  exists(value) {
    return this._where('exists', value);
  }

  between(value) {
    return this._where('between', value);
  }
}