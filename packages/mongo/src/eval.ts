import { CompoundCondition, FieldCondition, Condition } from "@muast/ast";
import { Comparable } from './types'

const processors = {
  $or(node: CompoundCondition, query: object): boolean {
    return node.conditions.some(condition => test(condition, query))
  },
  $and(node: CompoundCondition, query: object): boolean {
    return node.conditions.every(condition => test(condition, query))
  },
  $not(node: CompoundCondition, query: object): boolean {
    return !test(node.conditions[0], query);
  },
  $eq(node: FieldCondition, object: any) {
    return object[node.field] === node.value
  },
  $ne(node: FieldCondition, object: any) {
    return !this.$eq(node, object);
  },
  $lte(node: FieldCondition<Comparable>, object: any) {
    return object[node.field] <= node.value
  },
  $lt(node: FieldCondition<Comparable>, object: any) {
    return object[node.field] < node.value
  },
  $gt(node: FieldCondition<Comparable>, object: any) {
    return object[node.field] > node.value
  },
  $gte(node: FieldCondition<Comparable>, object: any) {
    return object[node.field] >= node.value
  },
  $exists(node: FieldCondition<boolean>, object: any) {
    return object.hasOwnProperty(node.field) === node.value;
  },
  $mod(node: FieldCondition<[number, number]>, object: any) {
    return object[node.field] % node.value[0] === node.value[1];
  },
  $size(node: FieldCondition, object: any) {
    return object[node.field].length === node.value
  },
  $type(node: FieldCondition, object: any) {
    return typeof object[node.field] === node.value
  },
  $regex(node: FieldCondition<RegExp>, object: any) {
    return node.value.test(object[node.field])
  },
  $where(node: FieldCondition<Function>, object: any) {
    return node.value(object[node.field]);
  },
  $in(node: FieldCondition<unknown[]>, object: any) {
    const value = object[node.field];

    if (Array.isArray(value)) {
      return node.value.some((v: any) => value.includes(v));
    }

    return node.value.includes(value);
  },
  $all(node: FieldCondition<unknown[]>, object: any) {
    const value = object[node.field];

    if (Array.isArray(value)) {
      return value.every(v => node.value.includes(v));
    }

    return false;
  },
  $elemMatch(node: FieldCondition<Condition>, object: any): boolean {
    const value = object[node.field];

    if (Array.isArray(value)) {
      return value.some(v => test(node.value, v));
    }

    return false;
  },
};

export function test(node: Condition, object: object) {
  const op = node.operator as keyof typeof processors;
  return processors[op](node as any, object);
}
