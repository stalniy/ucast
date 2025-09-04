import { Condition } from './Condition';

type FnWithoutLastArgument<T extends (...args: any[]) => any> =
    T extends (...args: [...infer R, any]) => infer Ret
      ? (...args: R) => Ret
      : never;

type ArgsExceptLast<T extends (...args: any[]) => any> = Parameters<FnWithoutLastArgument<T>>;

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
    throw new Error(`Unable to interpret "${operator as string}" condition. Did you forget to register interpreter for it?`);
  }

  return interpret;
}

export interface InterpreterOptions {
  numberOfArguments?: 1 | 2 | 3
  getInterpreterName?(condition: Condition, context: this): string
}

function defaultInterpreterName(condition: Condition) {
  return condition.operator;
}

export function createInterpreter<T extends AnyInterpreter, U extends {} = {}>(
  interpreters: Record<string, T>,
  rawOptions?: U
) {
  const options = rawOptions as U & InterpreterOptions;
  const getInterpreterName = options && options.getInterpreterName || defaultInterpreterName;
  const interpret = ((condition : Condition, ...params: any[]) => {
    const interpreterName = getInterpreterName(condition, options);
    const interpretOperator = getInterpreter(interpreters, interpreterName);
    return interpretOperator.apply(null, [condition, ...params, defaultContext]);// eslint-disable-line @typescript-eslint/no-use-before-define
  }) as unknown as InterpretationContext<T>['interpret'];

  const defaultContext = {
    ...options,
    interpret,
  } as InterpretationContext<T> & U;

  return defaultContext.interpret;
}
