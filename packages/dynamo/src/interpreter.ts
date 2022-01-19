import {
  createInterpreter,
  Condition,
  InterpretationContext,
} from '@ucast/core';

export class Query {
  private _expressions: string[] = [];
  private _names: Record<string, string> = {};
  private _values: Record<string, unknown> = {};
  private _placeholderString = 'p';
  private _lastPlaceholderIndex: number = 1;

  field(rawName: string) {
    // support fields with the dot in name (escaped like 'a\\.b')
    // and use placeholders to avoid conflicts with reserved words
    //
    // javascript doesn't support lookbehind, so reverse the string and use lookahead
    const names = rawName
      .split('')
      .reverse()
      .join('')
      .split(/\.(?!\\)/)!
      .reverse()
      .map(v => v.split('').reverse().join(''));

    const keys = names.map(part => `#${part}`.replace(/\\\./g, '_'));
    keys.forEach((key, i) => {
      this._names[key.replace(/\[\d+\]/g, '')] = names[i]
        .replace(/\\\./g, '.')
        .replace(/\[\d+\]/g, '');
    });
    return keys.join('.');
  }

  param(value: unknown) {
    const idx = this._lastPlaceholderIndex + Object.keys(this._values).length;
    const key = `:${this._placeholderString}${idx}`;
    this._values[key] = value;
    return key;
  }

  manyParams(items: unknown[]) {
    return items.map(value => this.param(value));
  }

  child() {
    const query = new Query();
    query._lastPlaceholderIndex = this._lastPlaceholderIndex + Object.keys(this._values).length;
    return query;
  }

  where(field: string, operator: string, value: unknown) {
    const expression = `${this.field(field)} ${operator} ${this.param(value)}`;
    return this.whereRaw(expression);
  }

  whereRaw(expression: string) {
    this._expressions.push(expression);
    return this;
  }

  merge(
    query: Query,
    operator: 'AND' | 'OR' = 'AND',
    isInverted: boolean = false
  ) {
    let expression = query._expressions.join(` ${operator} `);
    if (expression[0] !== '(') {
      expression = `(${expression})`;
    }

    this._expressions.push(`${isInverted ? 'NOT ' : ''}${expression}`);
    this._names = { ...this._names, ...query._names };
    this._values = { ...this._values, ...query._values };
    return this;
  }

  toJSON(): [string, Record<string, string>, Record<string, unknown>] {
    return [this._expressions.join(' AND '), this._names, this._values];
  }
}

export type DynamoOperator<C extends Condition> = (
  condition: C,
  query: Query,
  context: InterpretationContext<DynamoOperator<C>>
) => Query;

export function createDynamoInterpreter(
  operators: Record<string, DynamoOperator<any>>
) {
  const interpret = createInterpreter<DynamoOperator<any>>(operators);
  return (condition: Condition) => {
    return interpret(condition, new Query()).toJSON();
  };
}
