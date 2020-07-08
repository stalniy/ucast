import { expect } from 'chai'
import { createTranslatorFactory, FieldCondition, createInterpreter, InterpretationContext } from '../src'

type Interpreter = (
  node: FieldCondition,
  value: string,
  context: InterpretationContext<Interpreter>
) => boolean

describe('createTranslatorFactory', () => {
  const parse = (value: string) => new FieldCondition('eq', 'title', value)
  const interpret = createInterpreter<Interpreter>({
    eq(node: FieldCondition, value: string) {
      return node.value === value
    }
  })

  it('creates a factory function that parses and interprets query', () => {
    const factory = createTranslatorFactory(parse, interpret)
    const translate = factory('test')

    expect(factory).to.be.a('function')
    expect(translate('test')).to.be.true
    expect(translate('test2')).to.be.false
  })
})
