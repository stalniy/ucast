import { FieldCondition as Field, CompoundCondition } from '@ucast/core'
import { expect } from './specHelper'
import {
  createDynamoInterpreter,
  eq,
  ne,
  lte,
  lt,
  gte,
  gt,
  exists,
  within,
  nin,
  and,
  not,
  or,
  nor,
} from '../src'

describe('Condition Interpreter', () => {
  describe('primitive operators', () => {
    const interpret = createDynamoInterpreter({ eq, ne, lt, lte, gt, gte })

    it('generates query with `=` operator for "eq"', () => {
      const condition = new Field('eq', 'name', 'test')
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#name = :p1')
      expect(names).to.deep.equal({ '#name': 'name' })
      expect(values).to.deep.equal({ ':p1': 'test' })
    })

    it('generates query with `<>` operator for "ne"', () => {
      const condition = new Field('ne', 'name', 'test')
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#name <> :p1')
      expect(names).to.deep.equal({ '#name': 'name' })
      expect(values).to.deep.equal({ ':p1': 'test' })
    })

    it('generates query with `<` operator for "lt"', () => {
      const condition = new Field('lt', 'age', 10)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age < :p1')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 10 })
    })

    it('generates query with `<=` operator for "lte"', () => {
      const condition = new Field('lte', 'age', 10)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age <= :p1')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 10 })
    })

    it('generates query with `>` operator for "gt"', () => {
      const condition = new Field('gt', 'age', 10)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age > :p1')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 10 })
    })

    it('generates query with `>=` operator for "gte"', () => {
      const condition = new Field('gte', 'age', 10)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age >= :p1')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 10 })
    })
  })

  describe('exists', () => {
    const interpret = createDynamoInterpreter({ exists })

    it('generates query with `is not null` operator when value equals `true`', () => {
      const condition = new Field('exists', 'address', true)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('attribute_exists(#address)')
      expect(names).to.deep.equal({ '#address': 'address' })
      expect(values).to.be.empty
    })

    it('generates query with `is null` operator when value equals `false`', () => {
      const condition = new Field('exists', 'address', false)
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('attribute_not_exists(#address)')
      expect(names).to.deep.equal({ '#address': 'address' })
      expect(values).to.be.empty
    })
  })

  describe('in (within, nin)', () => {
    const interpret = createDynamoInterpreter({ within, nin, and, eq })

    it('generates a separate placeholder for every element in the array', () => {
      const condition = new Field('within', 'age', [1, 2])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age IN(:p1, :p2)')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 1, ':p2': 2 })
    })

    it('correctly generates placeholders when combined with other operators', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'name', 'John'),
        new Field('within', 'age', [1, 2]),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('(#name = :p1 AND #age IN(:p2, :p3))')
      expect(names).to.deep.equal({ '#name': 'name', '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 'John', ':p2': 1, ':p3': 2 })
    })

    it('generates `not in` operator for "nin', () => {
      const condition = new Field('nin', 'age', [1, 2])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#age NOT IN(:p1, :p2)')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 1, ':p2': 2 })
    })
  })

  describe('compound operators', () => {
    const interpret = createDynamoInterpreter({
      or,
      nor,
      not,
      and,
      eq,
      lt,
      gt,
    })

    it('generates query with inverted condition for "not"', () => {
      const condition = new CompoundCondition('not', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 12),
          new Field('eq', 'age', 13),
        ]),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('NOT (#age = :p1 OR #age = :p2)')
      expect(names).to.deep.equal({ '#age': 'age' })
      expect(values).to.deep.equal({ ':p1': 12, ':p2': 13 })
    })

    it('generates query combined by logical `and` for "and"', () => {
      const condition = new CompoundCondition('and', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('(#age = :p1 AND #active = :p2)')
      expect(names).to.deep.equal({ '#age': 'age', '#active': 'active' })
      expect(values).to.deep.equal({ ':p1': 1, ':p2': true })
    })

    it('generates query combined by logical `or` for "or"', () => {
      const condition = new CompoundCondition('or', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('(#age = :p1 OR #active = :p2)')
      expect(names).to.deep.equal({ '#age': 'age', '#active': 'active' })
      expect(values).to.deep.equal({ ':p1': 1, ':p2': true })
    })

    it('generates inverted query combined by logical `or` for "nor"', () => {
      const condition = new CompoundCondition('nor', [
        new Field('eq', 'age', 1),
        new Field('eq', 'active', true),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('NOT (#age = :p1 OR #active = :p2)')
      expect(names).to.deep.equal({ '#age': 'age', '#active': 'active' })
      expect(values).to.deep.equal({ ':p1': 1, ':p2': true })
    })

    it('properly adds brackets for complex compound condition', () => {
      const condition = new CompoundCondition('or', [
        new CompoundCondition('or', [
          new Field('eq', 'age', 1),
          new Field('eq', 'age', 2),
        ]),
        new CompoundCondition('and', [
          new Field('gt', 'qty', 1),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('nor', [
          new Field('gt', 'qty', 10),
          new Field('lt', 'qty', 20),
        ]),
        new CompoundCondition('not', [
          new CompoundCondition('and', [
            new Field('eq', 'active', false),
            new Field('gt', 'age', 18),
          ]),
        ]),
      ])
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal(
        [
          '(#age = :p1 OR #age = :p2)',
          'OR (#qty > :p3 AND #qty < :p4)',
          'OR NOT (#qty > :p5 OR #qty < :p6)',
          'OR NOT (#active = :p7 AND #age > :p8)',
        ].join(' ')
      )
      expect(names).to.deep.equal({
        '#age': 'age',
        '#qty': 'qty',
        '#active': 'active',
      })
      expect(values).to.deep.equal({
        ':p1': 1,
        ':p2': 2,
        ':p3': 1,
        ':p4': 20,
        ':p5': 10,
        ':p6': 20,
        ':p7': false,
        ':p8': 18,
      })
    })
  })

  describe('nested attributes', () => {
    const interpret = createDynamoInterpreter({ eq })

    it('generates query for field with dot', () => {
      const condition = new Field('eq', 'some\\.name', 'test')
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#some_name = :p1')
      expect(names).to.deep.equal({ '#some_name': 'some.name' })
      expect(values).to.deep.equal({ ':p1': 'test' })
    })

    it('generates query for map elements', () => {
      const condition = new Field('eq', 'some.name', 'test')
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#some.#name = :p1')
      expect(names).to.deep.equal({ '#name': 'name', '#some': 'some' })
      expect(values).to.deep.equal({ ':p1': 'test' })
    })

    it('generates query for array', () => {
      const condition = new Field('eq', 'names[0]', 'test')
      const [expr, names, values] = interpret(condition)

      expect(expr).to.equal('#names[0] = :p1')
      expect(names).to.deep.equal({ '#names': 'names' })
      expect(values).to.deep.equal({ ':p1': 'test' })
    })
  })
})
