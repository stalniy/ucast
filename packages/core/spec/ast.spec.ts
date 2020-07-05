import { expect } from 'chai';
import { FieldCondition, CompoundCondition, Condition } from '../src';

describe('AST', () => {
  describe('CompoundCondition', () => {
    it('throws exception if receives non array', () => {
      expect(() => new CompoundCondition('and', null as unknown as Condition[])).to.throw(Error);
    })

    it('can add child conditions', () => {
      const node = new CompoundCondition('and', []);
      const fieldNode = new FieldCondition('eq', 'title', 'test');
      const fieldNodes = [new FieldCondition('eq', 'name', ''), new FieldCondition('lt', 'age', 12)];

      node.add(fieldNode);
      node.add(fieldNodes);

      expect(node.value).to.contain(fieldNode);
      expect(node.value).to.contain(fieldNodes[0]);
      expect(node.value).to.contain(fieldNodes[1]);
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
