import { createJsInterpreter } from './interpreter';
import * as interpreters from './interpreters';

export const allInterpreters = interpreters;
export const interpret = createJsInterpreter(interpreters);
