import { FieldCondition } from '@ucast/core'
import { MongoQueryParser, $eq } from '../src'
import { expect } from './specHelper'

describe('MongoQueryParser', () => {
  it('removes `$` prefix from resulting condition operator name', () => {
    const parser = new MongoQueryParser({ $eq })
    const ast = parser.parse({ age: { $eq: 1 } })

    expect(ast.operator).to.equal('eq')
  })

  it('uses `$eq` as default operator', () => {
    const parser = new MongoQueryParser({ $eq })
    const ast = parser.parse({ age: 1 })

    expect(ast.operator).to.equal('eq')
  })

  it('allows to parse field level operators when field is specified in context', () => {
    const parser = new MongoQueryParser({ $eq })
    const ast = parser.parse({ $eq: 5 }, { field: 'name' }) as FieldCondition

    expect(ast.operator).to.equal('eq')
    expect(ast.value).to.equal(5)
    expect(ast.field).to.equal('name')
  })
})
