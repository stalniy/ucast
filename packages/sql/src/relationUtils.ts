import { type RelationQueryContext } from './interpreter.ts';

export interface RelationColumnPair {
  parentField: string;
  relationField: string;
}

export interface ThroughRelationColumnPair {
  relationField: string;
  throughField: string;
}

export function buildDirectRelationQuery<F = string>(
  relationTable: string,
  columnPairs: readonly RelationColumnPair[],
) {
  return (ctx: RelationQueryContext<F>): F => {
    const relationConditions = ctx.join(columnPairs.map(pair =>
      ctx.sql`${ctx.parentField(pair.parentField)} = ${ctx.relationField(pair.relationField)}`
    ), ' AND ');

    return ctx.sql`SELECT 1 FROM ${ctx.escapeIdentifier(relationTable)} as ${ctx.escapeIdentifier(ctx.relationAlias)} WHERE ${relationConditions} AND (${ctx.conditionSql()})`;
  };
}

export function buildManyToManyRelationQuery<F = string>(
  throughTable: string,
  foreignTable: string,
  localColumns: readonly ThroughRelationColumnPair[],
  foreignColumns: readonly ThroughRelationColumnPair[],
) {
  return (ctx: RelationQueryContext<F>): F => {
    const throughAlias = `${ctx.relationAlias}_through`;
    const throughField = (field: string) =>
      ctx.sql`${ctx.escapeIdentifier(throughAlias)}.${ctx.escapeIdentifier(field)}`;
    const joinConditions = ctx.join(foreignColumns.map(column =>
      ctx.sql`${ctx.relationField(column.relationField)} = ${throughField(column.throughField)}`
    ), ' AND ');
    const whereConditions = ctx.join(localColumns.map(column =>
      ctx.sql`${ctx.parentField(column.relationField)} = ${throughField(column.throughField)}`
    ), ' AND ');

    return ctx.sql`SELECT 1 FROM ${ctx.escapeIdentifier(throughTable)} as ${ctx.escapeIdentifier(throughAlias)} INNER JOIN ${ctx.escapeIdentifier(foreignTable)} as ${ctx.escapeIdentifier(ctx.relationAlias)} ON ${joinConditions} WHERE ${whereConditions} AND (${ctx.conditionSql()})`;
  };
}
