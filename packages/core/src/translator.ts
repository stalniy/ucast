import { Condition } from './Condition';
import { Parse } from './types';
import { AnyInterpreter } from './interpreter';

type Bound<T> = T extends (first: any, ...args: infer A) => infer U
  ? { (...args: A): U, ast: Condition }
  : never;

export function createTranslatorFactory<Lang, Interpreter extends AnyInterpreter>(
  parse: Parse<Lang>,
  interpret: Interpreter
) {
  return (query: Lang, ...args: unknown[]): Bound<Interpreter> => {
    const ast = parse(query, ...args);
    const translate = (interpret as any).bind(null, ast);
    translate.ast = ast;
    return translate;
  };
}
