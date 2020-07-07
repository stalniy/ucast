import { expect, spy } from './specHelper';
import { FieldCondition as Field, ITSELF, DocumentCondition, CompoundCondition } from '@ucast/core';
import {
  $eq,
  $ne,
  $lte,
  $lt,
  $gt,
  $gte,
  $exists,
  $mod,
  $size,
  $regex,
  $where,
  $in,
  $nin,
  $all,
  $elemMatch,
  $and,
  $or,
  $nor,
  $not,
  createJsInterpreter
} from '../src';
import {
  includeExamplesForFieldCondition,
  includeExamplesForEqualityInterpreter,
} from './fieldConditionInterpreter.behavior';

describe('Condition Interpreter', () => {
  describe('$eq', () => {
    const interpret = createJsInterpreter({ $eq });

    includeExamplesForFieldCondition('$eq');
    includeExamplesForEqualityInterpreter('$eq');

    it('returns true if condition value is equal to field value of an object', () => {
      const condition = new Field('$eq', 'name', 'test');
      expect(interpret(condition, { name: 'test' })).to.be.true;
      expect(interpret(condition, { name: 'test2' })).to.be.false;
    })

    it('returns true if condition value is equal to value itself', () => {
      const condition = new Field('$eq', ITSELF, 'test');
      expect(interpret(condition, 'test')).to.be.true;
      expect(interpret(condition, 'test2')).to.be.false;
    })

    it('returns true if value is inside array if object field is an array', () => {
      const condition = new Field('$eq', 'items', 'test');
      expect(interpret(condition, { items: ['test', 'test3'] })).to.be.true;
      expect(interpret(condition, { items: ['test2', 'test3'] })).to.be.false;
    })

    it('compares arrays by reference', () => {
      const condition = new Field('$eq', 'value', ['test']);
      expect(interpret(condition, { value: condition.value })).to.be.true;
      expect(interpret(condition, { value: ['test'] })).to.be.false;
    })

    it('compares objects by reference', () => {
      const condition = new Field('$eq', 'value', { name: 'test' });
      expect(interpret(condition, { value: condition.value })).to.be.true;
      expect(interpret(condition, { value: { name: 'test' } })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.street")', () => {
      const condition = new Field('$eq', 'address.street', 'test');
      const object = { address: { street: 'test' } };

      expect(interpret(condition, object)).to.be.true;
    })
  })

  describe('$ne', () => {
    const interpret = createJsInterpreter({ $ne });

    includeExamplesForFieldCondition('$ne');
    includeExamplesForEqualityInterpreter('$ne');

    it('returns true if condition value is NOT equal to field value of an object', () => {
      const condition = new Field('$ne', 'name', 'test');
      expect(interpret(condition, { name: 'test' })).to.be.false;
      expect(interpret(condition, { name: 'test2' })).to.be.true;
    })

    it('can get value from object using dot notation (e.g., "address.street")', () => {
      const condition = new Field('$ne', 'address.street', 'test');
      const object = { address: { street: 'another' } };

      expect(interpret(condition, object)).to.be.true;
    })
  })

  describe('$lte', () => {
    const interpret = createJsInterpreter({ $lte });

    includeExamplesForFieldCondition('$lte');

    it('checks that object value is less or equal to condition value', () => {
      const condition = new Field('$lte', 'age', 10);

      expect(interpret(condition, { age: 9 })).to.be.true;
      expect(interpret(condition, { age: 10 })).to.be.true;
      expect(interpret(condition, { age: 11 })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$lte', 'address.building', 10);
      const object = (building: number) => ({ address: { building } });

      expect(interpret(condition, object(9))).to.be.true;
      expect(interpret(condition, object(10))).to.be.true;
      expect(interpret(condition, object(11))).to.be.false;
    })
  })

  describe('$lt', () => {
    const interpret = createJsInterpreter({ $lt });

    includeExamplesForFieldCondition('$lt');

    it('checks that object value is less than condition value', () => {
      const condition = new Field('$lt', 'age', 10);

      expect(interpret(condition, { age: 9 })).to.be.true;
      expect(interpret(condition, { age: 10 })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$lt', 'address.building', 10);
      const object = (building: number) => ({ address: { building } });

      expect(interpret(condition, object(9))).to.be.true;
      expect(interpret(condition, object(10))).to.be.false;
    })
  })

  describe('$gt', () => {
    const interpret = createJsInterpreter({ $gt });

    includeExamplesForFieldCondition('$gt');

    it('checks that object value is greater than condition value', () => {
      const condition = new Field('$gt', 'age', 10);

      expect(interpret(condition, { age: 11 })).to.be.true;
      expect(interpret(condition, { age: 10 })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$gt', 'address.building', 10);
      const object = (building: number) => ({ address: { building } });

      expect(interpret(condition, object(11))).to.be.true;
      expect(interpret(condition, object(10))).to.be.false;
    })
  })

  describe('$gte', () => {
    const interpret = createJsInterpreter({ $gte });

    includeExamplesForFieldCondition('$gte');

    it('checks that object value is greater than condition value', () => {
      const condition = new Field('$gte', 'age', 10);

      expect(interpret(condition, { age: 11 })).to.be.true;
      expect(interpret(condition, { age: 10 })).to.be.true;
      expect(interpret(condition, { age: 9 })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$gte', 'address.building', 10);
      const object = (building: number) => ({ address: { building } });

      expect(interpret(condition, object(11))).to.be.true;
      expect(interpret(condition, object(10))).to.be.true;
      expect(interpret(condition, object(9))).to.be.false;
    })
  })

  describe('$exists', () => {
    const interpret = createJsInterpreter({ $exists });

    it('can check whether object has own property', () => {
      const condition = new Field('$exists', 'address', true);

      expect(interpret(condition, {})).to.be.false;
      expect(interpret(condition, { address: 1 })).to.be.true;
      expect(interpret(condition, Object.create({ address: 1 }))).to.be.false
    })

    it('checks whether value is undefined in case it needs to check value itself', () => {
      const condition = new Field('$exists', ITSELF, true);

      expect(interpret(condition, {})).to.be.true;
      expect(interpret(condition, null)).to.be.true;
      expect(interpret(condition, undefined)).to.be.false;
    })

    it('can check existence of field specified using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$exists', 'address.building', true);

      expect(interpret(condition, {})).to.be.false;
      expect(interpret(condition, { address: {} })).to.be.false;
      expect(interpret(condition, { address: null })).to.be.false;
      expect(interpret(condition, { address: { building: 1 } })).to.be.true;
    })
  })

  describe('$mod', () => {
    const interpret = createJsInterpreter({ $mod });

    includeExamplesForFieldCondition('$mod');

    it('check that value of a field divided by a divisor has the specified remainder', () => {
      const condition = new Field('$mod', 'qty', [4, 0]);

      expect(interpret(condition, { qty: 12 })).to.be.true;
      expect(interpret(condition, { qty: 4 })).to.be.true;
      expect(interpret(condition, { qty: 13 })).to.be.false;
    })

    it('can get value from object using dot notation (e.g., "address.building")', () => {
      const condition = new Field('$mod', 'item.qty', [3, 1]);
      const object = (qty: number) => ({ item: { qty } });

      expect(interpret(condition, object(7))).to.be.true;
      expect(interpret(condition, object(6))).to.be.false;
    })

    it('can check value itself', () => {
      const condition = new Field('$mod', ITSELF, [3, 1]);

      expect(interpret(condition, 4)).to.be.true;
      expect(interpret(condition, 5)).to.be.false;
    })
  })

  describe('$size', () => {
    const interpret = createJsInterpreter({ $size });

    includeExamplesForFieldCondition('$size');

    it('checks array length', () => {
      const condition = new Field('$size', 'items', 2);

      expect(interpret(condition, { items: [1, 2] })).to.be.true;
      expect(interpret(condition, { items: [] })).to.be.false;
    })

    it('can check size of value itself', () => {
      const condition = new Field('$size', ITSELF, 2);

      expect(interpret(condition, [1, 2])).to.be.true;
      expect(interpret(condition, [])).to.be.false;
    })

    it('can check size of nested field', () => {
      const condition = new Field('$size', 'some.items', 2);
      const item = (items: unknown[]) => ({ some: { items } });

      expect(interpret(condition, item([1, 2]))).to.be.true;
      expect(interpret(condition, item([]))).to.be.false;
    })
  })

  describe('$regex', () => {
    const interpret = createJsInterpreter({ $regex });

    includeExamplesForFieldCondition('$regex', /@/);

    it('checks value using regular expression', () => {
      const condition = new Field('$regex', 'email', /@/);

      expect(interpret(condition, { email: '@' })).to.be.true;
      expect(interpret(condition, { email: 'some text' })).to.be.false;
    })

    it('can check value itself', () => {
      const condition = new Field('$regex', ITSELF, /@/);

      expect(interpret(condition, '@')).to.be.true;
      expect(interpret(condition, 'some text')).to.be.false;
    })

    it('can check value of nested field', () => {
      const condition = new Field('$regex', 'some.email', /@/);
      const item = (email: string) => ({ some: { email } });

      expect(interpret(condition, item('ucast@github.com'))).to.be.true;
      expect(interpret(condition, item('some text'))).to.be.false;
    })
  })

  describe('$where', () => {
    const interpret = createJsInterpreter({ $where });

    it('returns true if corresponding function returns true', () => {
      const condition = new DocumentCondition('$where', () => true);

      expect(interpret(condition, {})).to.be.true;
      expect(interpret(condition, null as unknown as Record<PropertyKey, unknown>)).to.be.true;
    })

    it('binds passed in object as "this"', () => {
      const object = {};
      const test = spy(function where(this: unknown) {
        return this === object;
      });
      const condition = new DocumentCondition('$where', test);

      expect(interpret(condition, object)).to.be.true;
      expect(interpret(condition, {})).to.be.false;
    })
  })

  describe('$in', () => {
    const interpret = createJsInterpreter({ $in });

    includeExamplesForFieldCondition('$in', []);

    it('checks if value is in specified array', () => {
      const condition = new Field('$in', 'age', [1, 2]);

      expect(interpret(condition, { age: 1 })).to.be.true;
      expect(interpret(condition, { age: 2 })).to.be.true;
      expect(interpret(condition, { age: 3 })).to.be.false;
    })

    it('checks that arrays intersects if field value is an array', () => {
      const condition = new Field('$in', 'items', [1, 2]);

      expect(interpret(condition, { items: [1, 3] })).to.be.true;
      expect(interpret(condition, { items: [2, 4] })).to.be.true;
      expect(interpret(condition, { items: [3, 5] })).to.be.false;
    })

    it('can check value of nested property', () => {
      const condition = new Field('$in', 'some.age', [1, 2]);
      const item = (age: number ) => ({ some: { age } });

      expect(interpret(condition, item(1))).to.be.true;
      expect(interpret(condition, item(2))).to.be.true;
      expect(interpret(condition, item(3))).to.be.false;
    })

    it('can check value itself', () => {
      const condition = new Field('$in', ITSELF, [1, 2]);

      expect(interpret(condition, 1)).to.be.true;
      expect(interpret(condition, 2)).to.be.true;
      expect(interpret(condition, 3)).to.be.false;
    })

    it('uses "equal" function from context to check equality of values', () => {
      const condition = new Field('$in', 'value', [1, 2]);
      const equal = spy(<T>(a: T, b: T) => a === b);
      const object = { value: condition.value };
      const test = createJsInterpreter({ $in }, { equal });
      test(condition, object);

      expect(equal).to.have.been.called.with(1, 1);
    })
  })

  describe('$nin', () => {
    const interpret = createJsInterpreter({ $nin });

    includeExamplesForFieldCondition('$nin', []);

    it('returns true if value is not in specified array', () => {
      const condition = new Field('$nin', 'age', [1, 2]);

      expect(interpret(condition, { age: 1 })).to.be.false;
      expect(interpret(condition, { age: 2 })).to.be.false;
      expect(interpret(condition, { age: 3 })).to.be.true;
    })
  })

  describe('$all', () => {
    const interpret = createJsInterpreter({ $all });

    includeExamplesForFieldCondition('$all', []);

    it('checks that all items from condition value are present at object field value', () => {
      const condition = new Field('$all', 'items', [1, 2]);

      expect(interpret(condition, { items: [1] })).to.be.false;
      expect(interpret(condition, { items: [1, 2] })).to.be.true;
      expect(interpret(condition, { items: [2, 1, 3] })).to.be.true;
    })

    it('returns false if object field is not an array', () => {
      const condition = new Field('$all', 'items', [1, 2]);
      expect(interpret(condition, { items: 1 })).to.be.false;
    })

    it('can check value of nested property', () => {
      const condition = new Field('$all', 'some.prices', [1, 2]);
      const item = (prices: number[] ) => ({ some: { prices } });

      expect(interpret(condition, item([2, 1]))).to.be.true;
      expect(interpret(condition, item([3, 1]))).to.be.false;
    })

    it('uses "equal" function from context to check equality of values', () => {
      const condition = new Field('$all', 'value', [1, 2]);
      const equal = spy(<T>(a: T, b: T) => a === b);
      const object = { value: condition.value };
      const test = createJsInterpreter({ $all }, { equal });
      test(condition, object);

      expect(equal).to.have.been.called.with(1, 1);
    })
  })

  describe('$elemMatch', () => {
    const interpret = createJsInterpreter({ $elemMatch, $and, $eq });

    includeExamplesForFieldCondition('$elemMatch', { a: 1 });

    it('returns false if object field is not an array', () => {
      const condition = new Field('$elemMatch', 'items', new Field('$eq', 'age', 1));
      expect(interpret(condition, { items: { age: 1 } })).to.be.false;
    })

    it('checks that field value item matches all conditions', () => {
      const condition = new Field('$elemMatch', 'items', new CompoundCondition('$and', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ]));
      const item = (items: object[]) => ({ items });

      expect(interpret(condition, item([{ age: 1 }]))).to.be.false;
      expect(interpret(condition, item([]))).to.be.false;
      expect(interpret(condition, item([{ age: 1 }, { active: true }]))).to.be.false;
      expect(interpret(condition, item([{ age: 1 }, { active: true }, { age: 1, active: true }]))).to.be.true;
    })
  })

  describe('$not', () => {
    const interpret = createJsInterpreter({ $not, $eq });

    it('inverts nested condition', () => {
      const condition = new CompoundCondition('$not', [
        new Field('$eq', 'age', 12),
      ]);

      expect(interpret(condition, { age: 12 })).to.be.false
      expect(interpret(condition, { age: 13 })).to.be.true
    })
  })

  describe('$and', () => {
    const interpret = createJsInterpreter({ $and, $eq });

    it('combines conditions using logical "and"', () => {
      const condition = new CompoundCondition('$and', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ]);

      expect(interpret(condition, { age: 1, active: true })).to.be.true;
      expect(interpret(condition, { age: 1, active: false })).to.be.false;
    })
  })

  describe('$or', () => {
    const interpret = createJsInterpreter({ $or, $eq });

    it('combines conditions using logical "or"', () => {
      const condition = new CompoundCondition('$or', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ]);

      expect(interpret(condition, { age: 1, active: true })).to.be.true;
      expect(interpret(condition, { age: 1, active: false })).to.be.true;
      expect(interpret(condition, { age: 10, active: true })).to.be.true;
      expect(interpret(condition, { age: 2, active: false })).to.be.false;
    })
  })

  describe('$nor', () => {
    const interpret = createJsInterpreter({ $nor, $eq });

    it('combines conditions using logical "not or"', () => {
      const condition = new CompoundCondition('$nor', [
        new Field('$eq', 'age', 1),
        new Field('$eq', 'active', true)
      ]);

      expect(interpret(condition, { age: 1, active: true })).to.be.false;
      expect(interpret(condition, { age: 1, active: false })).to.be.false;
      expect(interpret(condition, { age: 10, active: true })).to.be.false;
      expect(interpret(condition, { age: 2, active: false })).to.be.true;
    })
  })
})
