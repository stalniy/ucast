import * as interpreters from './interpreters';

export const allInterpreters = {
  ...interpreters,
  in: interpreters.within,
};
