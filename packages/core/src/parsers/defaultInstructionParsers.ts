import {
  FieldCondition,
  CompoundCondition,
  DocumentCondition,
} from '../Condition';
import {
  DocumentInstruction,
  CompoundInstruction,
  FieldInstruction,
} from '../types';

interface DefaultParsers {
  compound: Exclude<CompoundInstruction['parse'], undefined>,
  field: Exclude<FieldInstruction['parse'], undefined>,
  document: Exclude<DocumentInstruction['parse'], undefined>
}

export const defaultInstructionParsers: DefaultParsers = {
  compound(instruction, value, context) {
    const queries = Array.isArray(value) ? value : [value];
    const conditions = queries.map(query => context.parse(query));
    return new CompoundCondition(instruction.name, conditions);
  },
  field(instruction, value, context) {
    return new FieldCondition(instruction.name, context.field, value);
  },
  document(instruction, value) {
    return new DocumentCondition(instruction.name, value);
  }
};
