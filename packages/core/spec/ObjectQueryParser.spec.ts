import { expect, spy } from './specHelper'
import {
  FieldCondition,
  CompoundCondition,
  DocumentCondition,
  ObjectQueryParser,
  defaultInstructionParsers,
  ObjectQueryFieldParsingContext,
  ignoreValue
} from '../src'

describe('ObjectQueryParser', () => {
  const eq = { type: 'field' }
  const and = { type: 'compound' }
  const where = { type: 'document' }

  it('throws when trying to use unknown operator', () => {
    const parser = new ObjectQueryParser({})
    expect(() => parser.parse({ field: { unknown: true } })).to.throw(/Unsupported operator/)
  })

  it('throws when trying to use field level operator at root level', () => {
    const parser = new ObjectQueryParser({ eq })
    expect(() => parser.parse({ eq: 5 }))
      .to.throw(/Cannot use parsing instruction for operator "eq" in "document" context/)
  })

  it('throws when trying to use compound or value operator at field level', () => {
    const parser = new ObjectQueryParser({ and, where })
    expect(() => parser.parse({ field: { and: [] } })).to.throw(/Unexpected compound operator/)
    expect(() => {
      return parser.parse({ field: { where: () => true } })
    }).to.throw(/Unexpected document operator/)
  })

  it('parsed nested object "eq" condition', () => {
    const parser = new ObjectQueryParser({ eq })
    const ast = parser.parse({ foo: { bar: true } }) as FieldCondition

    expect(ast).to.be.instanceOf(FieldCondition)
    expect(ast.field).to.equal('foo.bar')
    expect(ast.value).to.equal(true)
    expect(ast.operator).to.equal('eq')
  })

  it('parses object value pairs as "and" of "eq" conditions', () => {
    const parser = new ObjectQueryParser({ and, eq })
    const ast = parser.parse({ a: 1, b: 2 }) as CompoundCondition
    const conditions = ast.value as FieldCondition[]

    expect(ast).to.be.instanceOf(CompoundCondition)
    expect(ast.operator).to.equal('and')
    expect(conditions).to.have.length(2)
    expect(conditions.every(c => c instanceof FieldCondition && c.operator === 'eq')).to.be.true
  })

  it('passes additional field context details during processing field level operators', () => {
    const my = { type: 'field', parse: spy(defaultInstructionParsers.field) }
    const parser = new ObjectQueryParser({ my }, {
      fieldContext: { check: true }
    })
    parser.parse({ field: { my: 1 } })
    const context = spy.calls(my.parse)[0][2] as { check: boolean }

    expect(context.check).to.be.true
  })

  it('passes additional document context details during processing document level and compound operators', () => {
    const document = { type: 'document', parse: spy(defaultInstructionParsers.document) }
    const compound = { type: 'compound', parse: spy(defaultInstructionParsers.compound) }
    const parser = new ObjectQueryParser({ document, compound }, {
      documentContext: { check: true }
    })
    parser.parse({ document: true, compound: [] })
    const documentContext = spy.calls(document.parse)[0][2] as { check: boolean }
    const compoundContext = spy.calls(compound.parse)[0][2] as { check: boolean }

    expect(documentContext.check).to.be.true
    expect(compoundContext.check).to.be.true
  })

  describe('when "field" level parsing instruction is specified', () => {
    it('parses it to `FieldCondition`', () => {
      const my = { type: 'field' }
      const parser = new ObjectQueryParser({ my })
      const ast = parser.parse({ field: { my: 1 } }) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('my')
      expect(ast.value).to.equal(1)
      expect(ast.field).to.equal('field')
    })

    it('uses its "validate" hook to validate operator value', () => {
      const my = { type: 'field', validate: spy() }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ field: { my: 1 } })

      expect(my.validate).to.have.been.called.with({ ...my, name: 'my' }, 1)
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const my = { type: 'field', parse: spy(defaultInstructionParsers.field) }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ field: { my: 1 } })
      const context = spy.calls(my.parse)[0][2] as ObjectQueryFieldParsingContext

      expect(my.parse).to.have.been.called.with({ ...my, name: 'my' }, 1, {
        field: 'field',
        query: { my: 1 },
        parse: parser.parse,
        hasOperators: context.hasOperators
      })
    })
  })

  describe('when "compound" level parsing instruction is specified', () => {
    it('parses it to `CompoundCondition`', () => {
      const my = { type: 'compound' }
      const parser = new ObjectQueryParser({ my })
      const ast = parser.parse({ my: [] }) as CompoundCondition

      expect(ast).to.be.instanceOf(CompoundCondition)
      expect(ast.operator).to.equal('my')
      expect(ast.value).to.have.length(0)
    })

    it('parses value as nested condition', () => {
      const parser = new ObjectQueryParser({ eq })
      const ast = parser.parse({ my: { a: 1 } }) as FieldCondition

      expect(ast).to.be.instanceOf(FieldCondition)
      expect(ast.operator).to.equal('eq')
      expect(ast.value).to.equal(1)
      expect(ast.field).to.equal('my.a')
    })

    it('uses its "validate" hook to validate operator value', () => {
      const my = { type: 'compound', validate: spy() }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ my: [] })

      expect(my.validate).to.have.been.called.with({ ...my, name: 'my' }, [])
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const my = { type: 'compound', parse: spy(defaultInstructionParsers.compound) }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ my: [] })

      expect(my.parse).to.have.been.called.with({ ...my, name: 'my' }, [], {
        parse: parser.parse,
        query: { my: [] },
      })
    })
  })

  describe('when "document" level parsing instruction is specified', () => {
    it('parses it to `DocumentCondition`', () => {
      const my = { type: 'document' }
      const parser = new ObjectQueryParser({ my })
      const ast = parser.parse({ my: 1 }) as DocumentCondition<number>

      expect(ast).to.be.instanceOf(DocumentCondition)
      expect(ast.operator).to.equal('my')
      expect(ast.value).to.equal(1)
    })

    it('uses its "validate" hook to validate operator value', () => {
      const my = { type: 'document', validate: spy() }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ my: 1 })

      expect(my.validate).to.have.been.called.with({ ...my, name: 'my' }, 1)
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const my = { type: 'document', parse: spy(defaultInstructionParsers.document) }
      const parser = new ObjectQueryParser({ my })
      parser.parse({ my: 2 })

      expect(my.parse).to.have.been.called.with({ ...my, name: 'my' }, 2, {
        parse: parser.parse,
        query: { my: 2 },
      })
    })
  })

  describe('when "useIgnoreValue" is enabled', () => {
    describe('field level operators', () => {
      it('ignores properties that equals to `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ eq }, { useIgnoreValue: true })
        const result = parser.parse({ id: ignoreValue, name: 'test' })

        expect(result).to.deep.equal(new FieldCondition('eq', 'name', 'test'))
      })

      it('returns empty "AND" condition if all properties equals to `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ eq }, { useIgnoreValue: true })
        const result = parser.parse({ id: ignoreValue, name: ignoreValue })

        expect(result).to.deep.equal(new CompoundCondition('and', [
        ]))
      })
    })

    describe('multiple field level operators per field', () => {
      it('ignores operators that equals to `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ eq, ne: eq }, { useIgnoreValue: true })
        const result = parser.parse({
          id: { eq: ignoreValue, ne: 5 },
          name: ignoreValue
        })

        expect(result).to.deep.equal(new FieldCondition('ne', 'id', 5))
      })

      it('interprets multiple field level operators as equality operator if all properties inside equal `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ eq }, { useIgnoreValue: true })
        const result = parser.parse({ id: { eq: ignoreValue } })

        expect(result).to.deep.equal(new CompoundCondition('and', []))
      })
    })

    describe('document level operators', () => {
      it('ignores operators that equals to `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ and, eq }, { useIgnoreValue: true })
        const result = parser.parse({ and: ignoreValue, id: 5 })

        expect(result).to.deep.equal(new FieldCondition('eq', 'id', 5))
      })

      it('interprets single operator as empty "AND" condition if it equals to `ignoreValue`', () => {
        const parser = new ObjectQueryParser({ and, eq }, { useIgnoreValue: true })
        const result = parser.parse({ and: ignoreValue })

        expect(result).to.deep.equal(new CompoundCondition('and', []))
      })

      it('interprets `ignoreValue` inside compound operator as empty "AND"', () => {
        const parser = new ObjectQueryParser({ and, eq }, { useIgnoreValue: true })
        const result = parser.parse({ and: [ignoreValue] })

        expect(result).to.deep.equal(new CompoundCondition('and', [
          new CompoundCondition('and', [])
        ]))
      })
    })
  })
})
