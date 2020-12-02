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
  let interpret;

  switch (options ? options.numberOfArguments : 0) {
    case 1:
      interpret = ((condition) => {
        const interpreterName = getInterpreterName(condition, options);
        const interpretOperator = getInterpreter(interpreters, interpreterName);
        return interpretOperator(condition, defaultContext); // eslint-disable-line @typescript-eslint/no-use-before-define
      }) as InterpretationContext<T>['interpret'];
      break;
    case 3:
      interpret = ((condition, value, params) => {
        const interpreterName = getInterpreterName(condition, options);
        const interpretOperator = getInterpreter(interpreters, interpreterName);
        return interpretOperator(condition, value, params, defaultContext); // eslint-disable-line @typescript-eslint/no-use-before-define
      }) as InterpretationContext<T>['interpret'];
      break;
    default:
      interpret = ((condition, value) => {
        const interpreterName = getInterpreterName(condition, options);
        const interpretOperator = getInterpreter(interpreters, interpreterName);
        return interpretOperator(condition, value, defaultContext); // eslint-disable-line @typescript-eslint/no-use-before-define
      }) as InterpretationContext<T>['interpret'];
      break;
  }

  const defaultContext = {
    ...options,
    interpret,
  } as InterpretationContext<T> & U;

  return defaultContext.interpret;
}
