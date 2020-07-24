import { createObjectionInterpreter } from './interpreter';
import * as interpreters from './interpreters';

export const allInterpreters = interpreters;
export const interpret = createObjectionInterpreter(interpreters);
