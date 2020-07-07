import { FieldCondition, CompoundCondition, DocumentCondition } from '@ucast/core';
import { MongoQueryParser, $eq, $and, $where, defaultParsers } from '../src';
import { expect, spy } from './specHelper';

describe('MongoQueryParser', () => {
  it('throws when trying to use unknown operator', () => {
    const parser = new MongoQueryParser({});
    expect(() => parser.parse({ field: { $unknown: true } })).to.throw(/Unsupported operator/);
  })

  it('throws when trying to use field level operator at root level', () => {
    const parser = new MongoQueryParser({ $eq });
    expect(() => parser.parse({ $eq: 5 })).to.throw(/Unknown top level operator/);
  })

  it('throws when trying to use compound or value operator at field level', () => {
    const parser = new MongoQueryParser({ $and, $where });
    expect(() => parser.parse({ field: { $and: [] } })).to.throw(/Unexpected compound operator/);
    expect(() => parser.parse({ field: { $where: () => true } })).to.throw(/Unexpected document operator/);
  })

  it('parses object value pairs as "$and" of "$eq" conditions', () => {
    const parser = new MongoQueryParser({ $and, $eq });
    const ast = parser.parse({ a: 1, b: 2 }) as CompoundCondition;
    const conditions = ast.value as FieldCondition[];

    expect(ast).to.be.instanceOf(CompoundCondition);
    expect(ast.operator).to.equal('$and');
    expect(conditions).to.have.length(2);
    expect(conditions.every(c => c instanceof FieldCondition && c.operator === '$eq')).to.be.true;
  })

  describe('when "field" level parsing instruction is specified', () => {
    it('parses it to `FieldCondition`', () => {
      const $my = { type: 'field' };
      const parser = new MongoQueryParser({ $my });
      const ast = parser.parse({ field: { $my: 1 } }) as FieldCondition;

      expect(ast).to.be.instanceOf(FieldCondition);
      expect(ast.operator).to.equal('$my');
      expect(ast.value).to.equal(1);
      expect(ast.field).to.equal('field');
    })

    it('uses its "validate" hook to validate operator value', () => {
      const $my = { type: 'field', validate: spy(), name: '$my' };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ field: { $my: 1 } });

      expect($my.validate).to.have.been.called.with($my, 1);
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const $my = { name: '$my', type: 'field', parse: spy(defaultParsers.field) };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ field: { $my: 1 } });

      expect($my.parse).to.have.been.called.with($my, 1, {
        field: 'field',
        parse: parser.parse,
        query: { $my: 1 },
      });
    })
  })

  describe('when "compound" level parsing instruction is specified', () => {
    it('parses it to `CompoundCondition`', () => {
      const $my = { type: 'compound' };
      const parser = new MongoQueryParser({ $my });
      const ast = parser.parse({ $my: [] }) as CompoundCondition;

      expect(ast).to.be.instanceOf(CompoundCondition);
      expect(ast.operator).to.equal('$my');
      expect(ast.value).to.have.length(0);
    })

    it('parses value as nested mongo query', () => {
      const $my = { name: '$my', type: 'compound' };
      const parser = new MongoQueryParser({ $my, $eq });
      const ast = parser.parse({ $my: { a: 1 } }) as CompoundCondition;
      const childAst = ast.value[0] as FieldCondition;

      expect(ast.value).to.have.length(1);
      expect(childAst).to.be.instanceOf(FieldCondition);
      expect(childAst.operator).to.equal('$eq');
      expect(childAst.value).to.equal(1);
      expect(childAst.field).to.equal('a');
    })

    it('uses its "validate" hook to validate operator value', () => {
      const $my = { type: 'compound', validate: spy(), name: '$my' };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ $my: [] });

      expect($my.validate).to.have.been.called.with($my, []);
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const $my = { name: '$my', type: 'compound', parse: spy(defaultParsers.compound) };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ $my: [] });

      expect($my.parse).to.have.been.called.with($my, [], {
        parse: parser.parse,
        query: { $my: [] },
      });
    })
  })

  describe('when "document" level parsing instruction is specified', () => {
    it('parses it to `DocumentCondition`', () => {
      const $my = { type: 'document' };
      const parser = new MongoQueryParser({ $my });
      const ast = parser.parse({ $my: 1 }) as DocumentCondition<number>;

      expect(ast).to.be.instanceOf(DocumentCondition);
      expect(ast.operator).to.equal('$my');
      expect(ast.value).to.equal(1);
    })

    it('uses its "validate" hook to validate operator value', () => {
      const $my = { type: 'document', validate: spy(), name: '$my' };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ $my: 1 });

      expect($my.validate).to.have.been.called.with($my, 1);
    })

    it('uses its "parse" hook to customize its parsing', () => {
      const $my = { name: '$my', type: 'document', parse: spy(defaultParsers.document) };
      const parser = new MongoQueryParser({ $my });
      parser.parse({ $my: 2 });

      expect($my.parse).to.have.been.called.with($my, 2, {
        parse: parser.parse,
        query: { $my: 2 },
      });
    })
  })
});
