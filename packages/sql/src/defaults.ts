import * as interpreters from './interpreters.ts';

export const allInterpreters = {
  ...interpreters,
  in: interpreters.within,
};
