import { Condition } from './Condition';
import { Parse } from "./types";
import { Interpret, Operator } from "./interpreter";

type Bound<T> = T extends (first: Condition, ...args: infer A) => any
  ? (...args: A) => ReturnType<T>
  : never;

export function createTranslator<Lang, Interpreter extends Interpret<Operator<any, any>>>(parse: Parse<Lang>, interpret: Interpreter) {
  return (query: Lang, ...args: unknown[]): Bound<Interpreter> => {
    const ast = parse(query, ...args);
    return (interpret as any).bind(null, ast);
  }
};
