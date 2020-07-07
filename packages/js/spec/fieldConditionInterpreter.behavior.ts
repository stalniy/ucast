import { expect, spy } from './specHelper';
import { FieldCondition as Field, ITSELF } from '@ucast/core';
import { createJsInterpreter, JsOperator, allInterpreters } from '../src';

type Operators = keyof typeof allInterpreters;

export function includeExamplesForFieldCondition(name: Operators, defaultValue: unknown = 1) {
  const operators = { [name]: allInterpreters[name] };

  it('uses "get" function from context to retrieve object value', () => {
    const condition = new Field(name, 'value', defaultValue);
    const object = { value: condition.value };
    const get = spy((object: Record<string, any>, field: string) => object[field]);
    const customInterpret = createJsInterpreter(operators, { get });
    customInterpret(condition, object);

    expect(get).to.have.been.called.with(object, condition.field);
  })
}

export function includeExamplesForEqualityInterpreter(name: Operators, defaultValue: unknown = []) {
  const operators = { [name]: allInterpreters[name] };

  it('uses "equal" function from context to check equality of values', () => {
    const condition = new Field(name, 'value', defaultValue);
    const equal = spy(<T>(a: T, b: T) => a === b);
    const object = { value: condition.value };
    const interpret = createJsInterpreter(operators, { equal });
    interpret(condition, object);

    expect(equal).to.have.been.called.with(condition.value, object.value);
  })
}
