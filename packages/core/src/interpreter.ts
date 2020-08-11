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

function getInterpreter<T extends Record<string, AnyInterpreter>>(
  interpreters: T,
  operator: keyof T
) {
  const interpret = interpreters[operator];

  if (typeof interpret !== 'function') {
    throw new Error(`Unable to interpret "${operator}" condition. Did you forget to register interpreter for it?`);
  }

  return interpret;
}

export interface InterpreterOptions {
  numberOfArguments?: 2 | 3
}

export function createInterpreter<T extends AnyInterpreter, U extends {} = {}>(
  interpreters: Record<string, T>,
  options?: U
) {
  const defaultContext = {
    ...options,
    interpret: options && (options as InterpreterOptions).numberOfArguments === 3
      ? (condition, value, params) => {
        const interpretOperator = getInterpreter(interpreters, condition.operator);
        return interpretOperator(condition, value, params, defaultContext);
      }
      : (condition, value) => {
        const interpretOperator = getInterpreter(interpreters, condition.operator);
        return interpretOperator(condition, value, defaultContext);
      }
  } as InterpretationContext<T> & U;

  return defaultContext.interpret;
}
