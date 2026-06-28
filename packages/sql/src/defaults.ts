import * as interpreters from './interpreters.ts';

export const allInterpreters = {
  ...interpreters,
  in: interpreters.within,
  some: interpreters.someRelation,
  none: interpreters.noneRelation,
  every: interpreters.everyRelation,
  is: interpreters.isRelation,
  isNot: interpreters.isNotRelation,
};
