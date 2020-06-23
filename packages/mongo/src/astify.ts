import { Parser } from './Parser';
import * as instructions from './instructions';
import { test } from './eval';

const parser = new Parser(instructions);
const conditions = {
  comments: {
    $where(value: unknown) {
      console.log(value, '<--');
      return true;
    }
  }
}

console.time('parse');
// for (let i = 0; i < 100; i++) {
  const ast = parser.parse(conditions as any);
// }
console.timeEnd('parse');

console.dir(ast, { depth: null });
console.time('eval');
console.log(test(ast, {
  comments: []
}));
console.timeEnd('eval');
