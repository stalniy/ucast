import { Condition } from './Condition';
import { optimizedCompoundCondition } from './utils';

export const and = (conditions: Condition[]) => optimizedCompoundCondition('and', conditions);
export const or = (conditions: Condition[]) => optimizedCompoundCondition('or', conditions);
