import { expect } from 'chai'
import { optimizedCompoundCondition, FieldCondition, CompoundCondition } from '../src'

describe('optimizedCompoundCondition', () => {
  const child = new FieldCondition('eq', 'x', 1)

  it('returns child condition if there is only 1 condition passed', () => {
    const ast = optimizedCompoundCondition('and', [child])
    expect(ast).to.equal(child)
  })

  it('merges children conditions with the same name recursively', () => {
    const ast = optimizedCompoundCondition('and', [
      new CompoundCondition('and', [
        new CompoundCondition('and', [child]),
        child
      ]),
      child
    ])

    expect(ast).to.deep.equal(new CompoundCondition('and', [child, child, child]))
  })

  it('does not merge compound conditions with another operator name', () => {
    const ast = optimizedCompoundCondition('and', [
      new CompoundCondition('and', [
        new CompoundCondition('or', [child]),
        child
      ]),
      child
    ])

    expect(ast).to.deep.equal(new CompoundCondition('and', [
      new CompoundCondition('or', [child]),
      child,
      child
    ]))
  })
})
