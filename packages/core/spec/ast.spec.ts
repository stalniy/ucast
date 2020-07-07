import { expect } from 'chai';
import { FieldCondition, CompoundCondition, Condition } from '../src';

describe('AST', () => {
  describe('CompoundCondition', () => {
    it('throws exception if receives non array', () => {
      expect(() => new CompoundCondition('and', null as unknown as Condition[])).to.throw(Error);
    })
  })

  describe('FieldCondition', () => {
    it('has "operator" property', () => {
      const node = new FieldCondition('eq', 'name', 'test');
      expect(node.operator).to.equal('eq');
    })

    it('has "field" property', () => {
      const node = new FieldCondition('eq', 'name', 'test');
      expect(node.field).to.equal('name');
    })

    it('has "value" property', () => {
      const node = new FieldCondition('eq', 'name', 'test');
      expect(node.value).to.equal('test');
    })
  })
})
