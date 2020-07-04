import { expect } from 'chai';
import { createTranslator, FieldCondition, createInterpreter, InterpretationContext } from '../src';

describe('createTranslator', () => {
  const parse = (value: string) => new FieldCondition('eq', 'title', value);
  type Operator = (node: FieldCondition, value: string, context: InterpretationContext<Operator>) => boolean;
  const interpret = createInterpreter<Operator>({
    eq(node: FieldCondition, value: string) {
      return node.value === value;
    }
  })

  it('creates a factory function that parses and interprets query', () => {
    const factory = createTranslator(parse, interpret);
    const translate = factory('test');

    expect(factory).to.be.a('function');
    expect(translate('test')).to.be.true;
    expect(translate('test2')).to.be.false;
  })
})
