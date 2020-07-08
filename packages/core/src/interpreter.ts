import { Condition } from './Condition';

type ArgsExceptLast<F extends (...args: any[]) => any> =
  F extends (a: any, c: any) => any
    ? Parameters<(condition: Condition) => 0>
    : F extends (a: any, b: any, c: any) => any
      ? Parameters<(condition: Condition, value: Parameters<F>[1]) => 0>
      : Parameters<(
        condition: Condition,
        value: Parameters<F>[1],
        options: Parameters<F>[2],
        ...args: unknown[]
      ) => 0>;

export type Interpreter<T extends Condition, R> = (condition: T, ...args: any[]) => R;
export type AnyInterpreter = Interpreter<any, any>;
export interface InterpretationContext<T extends AnyInterpreter> {
  interpret(...args: ArgsExceptLast<T>): ReturnType<T>;
}

export function createInterpreter<T extends AnyInterpreter, U extends {} = {}>(
  interpreters: Record<string, T>,
  options?: U
) {
  const defaultContext = {
    ...options,
    interpret(condition, ...args): ReturnType<T> {
      const interpretOperator = interpreters[condition.operator];

      if (typeof interpretOperator !== 'function') {
        throw new Error(`Unable to interpret "${condition.operator}" condition. Did you forget to register interpreter for it?`);
      }

      (args as unknown[]).push(defaultContext);

      return interpretOperator(condition, ...args);
    }
  } as InterpretationContext<T> & U;

  return defaultContext.interpret;
}
