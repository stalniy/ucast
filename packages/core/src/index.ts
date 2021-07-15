import { ObjectQueryParser } from './parsers/ObjectQueryParser';

export * from './Condition';
export * from './types';
export * from './interpreter';
export * from './translator';
export * from './builder';
export {
  isCompound,
  hasOperators,
  identity,
  object,
  optimizedCompoundCondition,
  ignoreValue,
} from './utils';
export type {
  IgnoreValue
} from './utils';
export * from './parsers/ObjectQueryParser';
export * from './parsers/defaultInstructionParsers';
/**
 * @deprecated use `ObjectQueryParser#parseInstruction` instead
 * TODO(major): remove
 */
export const parseInstruction = (ObjectQueryParser.prototype as any).parseInstruction;
