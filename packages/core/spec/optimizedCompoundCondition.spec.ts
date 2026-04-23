import { expect } from 'chai'
import { optimizedCompoundCondition, FieldCondition, CompoundCondition, buildAnd, buildOr } from '../src'

describe('optimizedCompoundCondition', () => {
  const child = new FieldCondition('eq', 'x', 1)

  it('returns child condition if there is only 1 condition passed', () => {
    const ast = optimizedCompoundCondition('and', [child])
    expect(ast).to.equal(child)
  })

  it('reuses conditions array if there is nothing to flatten', () => {
    const conditions = [child, child]
    const ast = optimizedCompoundCondition('and', conditions) as CompoundCondition
    expect(ast.value).to.equal(conditions)
  })

  it('merges direct children conditions with the same name', () => {
    const ast = optimizedCompoundCondition('and', [
      optimizedCompoundCondition('and', [
        optimizedCompoundCondition('and', [child]),
        child
      ]),
      child
    ])

    expect(ast).to.deep.equal(new CompoundCondition('and', [
      child,
      child,
      child
    ]))
  })

  it('does not merge compound conditions with another operator name', () => {
    const ast = optimizedCompoundCondition('and', [
      optimizedCompoundCondition('and', [
        optimizedCompoundCondition('or', [child]),
        child
      ]),
      child
    ])

    expect(ast).to.deep.equal(new CompoundCondition('and', [
      child,
      child,
      child
    ]))
  })

  it('removes empty compound identity conditions', () => {
    expect(buildAnd([new CompoundCondition('and', []), child])).to.equal(child)
    expect(buildOr([new CompoundCondition('or', []), child])).to.equal(child)
  })

  it('preserves empty compound conditions with another operator name', () => {
    expect(buildAnd([
      buildOr([buildOr([])]),
      buildOr([]),
      child
    ])).to.deep.equal(new CompoundCondition('and', [
      new CompoundCondition('or', []),
      new CompoundCondition('or', []),
      child
    ]))

    expect(buildOr([
      buildAnd([buildAnd([])]),
      child
    ])).to.deep.equal(new CompoundCondition('or', [
      new CompoundCondition('and', []),
      child
    ]))
  })
})
