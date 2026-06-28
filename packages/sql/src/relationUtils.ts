import { type RelationQueryContext } from './interpreter.ts';

export interface RelationColumnPair {
  parentField: string;
  relationField: string;
}

export interface ThroughRelationColumnPair {
  relationField: string;
  throughField: string;
}

export function buildDirectRelationQuery(
  relationTable: string,
  columnPairs: readonly RelationColumnPair[],
) {
  return (ctx: RelationQueryContext) => {
    const relationConditions = columnPairs
      .map(pair => `${ctx.parentField(pair.parentField)} = ${ctx.relationField(pair.relationField)}`)
      .join(' AND ');

    return `SELECT 1 FROM ${ctx.escapeField(relationTable)} as ${ctx.escapeField(ctx.relationAlias)}` +
      ` WHERE ${relationConditions}` +
      ` AND (${ctx.conditionSql()})`;
  };
}

export function buildManyToManyRelationQuery(
  throughTable: string,
  foreignTable: string,
  localColumns: readonly ThroughRelationColumnPair[],
  foreignColumns: readonly ThroughRelationColumnPair[],
) {
  return (ctx: RelationQueryContext) => {
    const throughAlias = ctx.escapeField(`${ctx.relationAlias}_through`);
    const throughField = (field: string) => `${throughAlias}.${ctx.escapeField(field)}`;
    const joinConditions = foreignColumns
      .map(column => `${ctx.relationField(column.relationField)} = ${throughField(column.throughField)}`)
      .join(' AND ');
    const whereConditions = localColumns
      .map(column => `${ctx.parentField(column.relationField)} = ${throughField(column.throughField)}`)
      .join(' AND ');

    return `SELECT 1 FROM ${ctx.escapeField(throughTable)} as ${throughAlias}` +
      ` INNER JOIN ${ctx.escapeField(foreignTable)} as ${ctx.escapeField(ctx.relationAlias)}` +
      ` ON ${joinConditions}` +
      ` WHERE ${whereConditions}` +
      ` AND (${ctx.conditionSql()})`;
  };
}
