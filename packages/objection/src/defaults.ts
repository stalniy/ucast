import { createObjectionInterpreter } from './interpreter';
import * as interpreters from './interpreters';

export const allInterpreters = {
  ...interpreters,
  in: interpreters.within,
};
export const interpret = createObjectionInterpreter(interpreters);
