/* eslint @typescript-eslint/no-unused-expressions: "off" */
import { FieldCondition as Field, ITSELF } from '@ucast/core'
import { expect, spy } from './specHelper'
import { allInterpreters, createJsInterpreter } from '../src'
import { includeExamplesForFieldCondition } from './fieldConditionInterpreter.behavior'

export function includeExamplesForLikeInterpreter(name: 'like' | 'ilike') {
  const interpret = createJsInterpreter({ [name]: allInterpreters[name] })

  includeExamplesForFieldCondition(name, 'test')

  it('matches the whole string when the pattern has no wildcards', () => {
    const condition = new Field(name, 'value', 'test')

    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: 'other' })).to.be.false
    expect(interpret(condition, { value: 'testing' })).to.be.false
    expect(interpret(condition, { value: 'a test' })).to.be.false
  })

  it('matches a prefix followed by percent', () => {
    const condition = new Field(name, 'value', 'test%')

    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: 'testing' })).to.be.true
    expect(interpret(condition, { value: 'a test' })).to.be.false
  })

  it('matches a suffix preceded by percent', () => {
    const condition = new Field(name, 'value', '%test')

    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: 'a test' })).to.be.true
    expect(interpret(condition, { value: 'testing' })).to.be.false
  })

  it('matches a substring surrounded by percent', () => {
    const condition = new Field(name, 'value', '%test%')

    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: 'a testing string' })).to.be.true
    expect(interpret(condition, { value: 'other' })).to.be.false
  })

  it('matches only an empty string with an empty pattern', () => {
    const condition = new Field(name, 'value', '')

    expect(interpret(condition, { value: '' })).to.be.true
    expect(interpret(condition, { value: 'test' })).to.be.false
  })

  it('matches any string with percent alone', () => {
    const condition = new Field(name, 'value', '%')

    expect(interpret(condition, { value: '' })).to.be.true
    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: '\n' })).to.be.true
  })

  it('matches zero or more characters with repeated percent wildcards', () => {
    const condition = new Field(name, 'value', 'a%%b')

    expect(interpret(condition, { value: 'ab' })).to.be.true
    expect(interpret(condition, { value: 'a middle b' })).to.be.true
    expect(interpret(condition, { value: 'a' })).to.be.false
    expect(interpret(condition, { value: 'b' })).to.be.false
  })

  it('matches exactly one character with underscore, including a line break', () => {
    const condition = new Field(name, 'value', 'a_b')

    expect(interpret(condition, { value: 'acb' })).to.be.true
    expect(interpret(condition, { value: 'a b' })).to.be.true
    expect(interpret(condition, { value: 'a\nb' })).to.be.true
    expect(interpret(condition, { value: 'ab' })).to.be.false
    expect(interpret(condition, { value: 'accb' })).to.be.false
  })

  it('matches one Unicode code point with underscore', () => {
    const condition = new Field(name, 'value', '_')

    expect(interpret(condition, { value: '😀' })).to.be.true
    expect(interpret(condition, { value: 'é' })).to.be.true
    expect(interpret(condition, { value: '' })).to.be.false
    expect(interpret(condition, { value: 'ab' })).to.be.false
    expect(interpret(condition, { value: 'e\u0301' })).to.be.false
  })

  it('matches line breaks with percent', () => {
    const condition = new Field(name, 'value', 'a%b')

    expect(interpret(condition, { value: 'ab' })).to.be.true
    expect(interpret(condition, { value: 'a\nb' })).to.be.true
    expect(interpret(condition, { value: 'a\r\nb' })).to.be.true
    expect(interpret(condition, { value: 'a\nc' })).to.be.false
  })

  it('treats an escaped percent as a literal character', () => {
    const condition = new Field(name, 'value', 'a\\%b')

    expect(interpret(condition, { value: 'a%b' })).to.be.true
    expect(interpret(condition, { value: 'ab' })).to.be.false
    expect(interpret(condition, { value: 'axyb' })).to.be.false
  })

  it('treats an escaped underscore as a literal character', () => {
    const condition = new Field(name, 'value', 'a\\_b')

    expect(interpret(condition, { value: 'a_b' })).to.be.true
    expect(interpret(condition, { value: 'acb' })).to.be.false
    expect(interpret(condition, { value: 'ab' })).to.be.false
  })

  it('treats an escaped backslash as a literal character', () => {
    const condition = new Field(name, 'value', 'a\\\\b')

    expect(interpret(condition, { value: 'a\\b' })).to.be.true
    expect(interpret(condition, { value: 'ab' })).to.be.false
    expect(interpret(condition, { value: 'a/b' })).to.be.false
  })

  it('treats an escaped ordinary character as a literal character', () => {
    const condition = new Field(name, 'value', '\\a')

    expect(interpret(condition, { value: 'a' })).to.be.true
    expect(interpret(condition, { value: '\\a' })).to.be.false
  })

  it('treats regular expression metacharacters as literal characters', () => {
    const condition = new Field(name, 'value', '.^$*+?()[]{}|')

    expect(interpret(condition, { value: '.^$*+?()[]{}|' })).to.be.true
    expect(interpret(condition, { value: '' })).to.be.false
    expect(interpret(condition, { value: 'anything' })).to.be.false
  })

  it('treats brackets as literal characters', () => {
    const condition = new Field(name, 'value', '[ab]')

    expect(interpret(condition, { value: '[ab]' })).to.be.true
    expect(interpret(condition, { value: 'a' })).to.be.false
    expect(interpret(condition, { value: 'b' })).to.be.false
  })

  it('rejects an extra final line break when the pattern does not consume it', () => {
    const condition = new Field(name, 'value', 'test')

    expect(interpret(condition, { value: 'test' })).to.be.true
    expect(interpret(condition, { value: 'test\n' })).to.be.false
    expect(interpret(condition, { value: 'test\r' })).to.be.false
    expect(interpret(condition, { value: 'test\u2028' })).to.be.false
    expect(interpret(condition, { value: 'test\u2029' })).to.be.false
  })

  it('matches a final line break when percent consumes it', () => {
    const condition = new Field(name, 'value', 'test%')

    expect(interpret(condition, { value: 'test\n' })).to.be.true
    expect(interpret(condition, { value: 'test\r\n' })).to.be.true
    expect(interpret(condition, { value: 'other\n' })).to.be.false
  })

  it('can check value itself', () => {
    const condition = new Field(name, ITSELF, 'test%')

    expect(interpret(condition, 'testing')).to.be.true
    expect(interpret(condition, 'other')).to.be.false
  })

  it('can check value of a nested field', () => {
    const condition = new Field(name, 'item.name', 'test%')

    expect(interpret(condition, { item: { name: 'testing' } })).to.be.true
    expect(interpret(condition, { item: { name: 'other' } })).to.be.false
    expect(interpret(condition, {})).to.be.false
  })

  it('returns false for non-string candidates without coercing them', () => {
    const condition = new Field(name, 'value', '%')

    expect(interpret(condition, { value: null })).to.be.false
    expect(interpret(condition, { value: undefined })).to.be.false
    expect(interpret(condition, { value: 123 })).to.be.false
    expect(interpret(condition, { value: true })).to.be.false
    expect(interpret(condition, { value: {} })).to.be.false
    expect(interpret(condition, { value: { toString: () => 'test' } })).to.be.false

    expect(interpret(condition, {})).to.be.false
  })

  it('checks whether any array item matches', () => {
    const condition = new Field(name, 'value', 'test%')

    expect(interpret(condition, { value: ['other', null, 'testing'] })).to.be.true
    expect(interpret(condition, { value: ['other', null] })).to.be.false
    expect(interpret(condition, { value: [] })).to.be.false
  })

  it('checks fields projected from arrays', () => {
    const condition = new Field(name, 'items.name', 'test%')

    expect(interpret(condition, { items: [{ name: 'other' }, { name: 'testing' }] }))
      .to.be.true
    expect(interpret(condition, { items: [{ name: 'other' }] })).to.be.false
  })

  it('uses a custom "isArray" function for array-like values', () => {
    const value = { 0: 'other', 1: 'testing', length: 2 }
    const isArray = spy((item: unknown) => item === value || Array.isArray(item))
    const customInterpret = createJsInterpreter({ [name]: allInterpreters[name] }, { isArray })

    expect(customInterpret(new Field(name, 'value', 'test%'), { value })).to.be.true
    expect(isArray).to.have.been.called.with(value)
  })

  it('produces the same result across repeated evaluations', () => {
    const condition = new Field(name, 'value', 'test%')

    expect(interpret(condition, { value: 'testing' })).to.be.true
    expect(interpret(condition, { value: 'testing' })).to.be.true
    expect(interpret(condition, { value: 'other' })).to.be.false
    expect(interpret(condition, { value: 'testing' })).to.be.true

    expect(condition.value).to.equal('test%')
  })

  it('rejects a trailing unpaired backslash', () => {
    const condition = new Field(name, 'value', 'test\\')

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects null patterns', () => {
    const condition = new Field(name, 'value', null)

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects undefined patterns', () => {
    const condition = new Field(name, 'value', undefined)

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects numeric patterns', () => {
    const condition = new Field(name, 'value', 123)

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects boolean patterns', () => {
    const condition = new Field(name, 'value', true)

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects object patterns', () => {
    const condition = new Field(name, 'value', {})

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })

  it('rejects RegExp patterns', () => {
    const condition = new Field(name, 'value', /test/)

    expect(() => interpret(condition, { value: 'test' })).to.throw()
  })
}
