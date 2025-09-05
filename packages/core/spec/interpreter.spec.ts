import { expect } from 'chai'
import { FieldCondition, createInterpreter } from '../src'

describe('createInterpreter', () => {
  let condition: FieldCondition

  beforeEach(() => {
    condition = new FieldCondition('eq', 'title', 'test')
  })

  it('creates a function which mimics return type and parameters of operators', () => {
    const eq = (_: FieldCondition, _1: string, _2: {}) => false
    const interpret = createInterpreter({ eq })
    const returnType: ReturnType<typeof interpret> = true
    const args: Parameters<typeof interpret> = [condition, 'test']

    expect(args).to.equal(args)
    expect(returnType).to.equal(true)
    expect(interpret).to.be.a('function')
  })

  it('throws exception if trying to interpret unknown operator', () => {
    const lt = (_: FieldCondition, _1: string, _2: {}) => false
    const interpret = createInterpreter({ lt })
    expect(() => interpret(condition, 'test')).to.throw(/Unable to interpret/)
  })

  it('passes options passed in "interpret" function and this function itself in operator interpreter as the last argument', () => {
    const eq = (_: FieldCondition, _1: string, context: any) => context
    const options = { a: 1, b: 2, c: Symbol('test') }
    const interpret = createInterpreter({ eq }, options)
    const context = interpret(condition, 'test')

    expect(context).to.deep.equal({ ...options, interpret })
  })
})
