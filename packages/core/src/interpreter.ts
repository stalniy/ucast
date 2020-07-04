import { Condition } from './Condition';

type ParametersExceptLast<F extends (...args: any[]) => any> =
  F extends (a: any, c: any) => any
    ? Parameters<(condition: Condition) => 0>
    : F extends (a: any, b: any, c: any) => any
      ? Parameters<(condition: Condition, value: Parameters<F>[1]) => 0>
      : F extends (a: any, b: any, c: any, d: any) => any
        ? Parameters<(condition: Condition, value: Parameters<F>[1], options: Parameters<F>[2]) => 0>
        : Parameters<(condition: Condition, value: Parameters<F>[1], options: Parameters<F>[2], ...args: any[]) => 0>;

export type Operator<ASTNode extends Condition, T> = (condition: ASTNode, ...args: any[]) => T;
export type Interpret<T extends Operator<any, any>> = (...args: ParametersExceptLast<T>) => ReturnType<T>;
export interface InterpretationContext<T extends Operator<any, any>> {
  interpret: Interpret<T>
}

export function createInterpreter<T extends Operator<any, any>, U extends {} = {}>(
  operators: Record<string, T>,
  options?: U
) {
  const defaultContext = {
    ...options,
    interpret(condition, ...rawArgs): ReturnType<T> {
      const interpretOperator = operators[condition.operator];

      if (typeof interpretOperator !== 'function') {
        throw new Error(`Unable to interpret "${condition.operator}" condition. Did you forget to register interpreter for it?`);
      }

      const args = rawArgs as unknown[] as any[];
      args.push(defaultContext);

      return interpretOperator(condition, ...args);
    }
  } as InterpretationContext<T> & U;

  return defaultContext.interpret;
};
