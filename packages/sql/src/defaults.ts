import * as interpreters from './interpreters.ts';

const { someRelation, noneRelation, everyRelation, ...otherInterpreters } = interpreters;
export const allInterpreters = {
  ...otherInterpreters,
  in: interpreters.within,
  some: someRelation,
  none: noneRelation,
  every: everyRelation,
};
