import { Condition } from './Condition';
import { optimizedCompoundCondition } from './utils';

export const buildAnd = (conditions: Condition[]) => optimizedCompoundCondition('and', conditions);
export const buildOr = (conditions: Condition[]) => optimizedCompoundCondition('or', conditions);
