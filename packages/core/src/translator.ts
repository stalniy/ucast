import { Condition } from './Condition';
import { Parse } from './types';
import { AnyInterpreter } from './interpreter';

type Bound<T> = T extends (first: Condition, ...args: infer A) => any
  ? { (...args: A): ReturnType<T>, ast: Condition }
  : never;

export function createTranslatorFactory<Lang, Interpreter extends AnyInterpreter>(
  parse: Parse<Lang>,
  interpret: Interpreter
) {
  return (query: Lang): Bound<Interpreter> => {
    const ast = parse(query);
    const translate = (interpret as any).bind(null, ast);
    translate.ast = ast;
    return translate;
  };
}
