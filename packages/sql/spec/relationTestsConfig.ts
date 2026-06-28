import { FieldCondition } from '@ucast/core'

export const relationSeeds = {
  users: [
    { id: 1, tenantId: 'tenant-a', name: 'Alice' },
    { id: 2, tenantId: 'tenant-a', name: 'Bob' },
    { id: 3, tenantId: 'tenant-b', name: 'Carol' },
  ],
  profiles: [
    { id: 1, userId: 1, displayName: 'Alice Profile' },
    { id: 2, userId: 2, displayName: 'Bob Profile' },
  ],
  projects: [
    { id: 1, userId: 1, name: 'Launch', active: true },
    { id: 2, userId: 1, name: 'Archive', active: false },
    { id: 3, userId: 2, name: 'Audit', active: true },
    { id: 4, userId: 3, name: 'Migration', active: false },
  ],
  deadlines: [
    { id: 1, projectId: 1, date: '2026-06-28' },
    { id: 2, projectId: 3, date: '2026-07-01' },
  ],
  roles: [
    { id: 1, name: 'admin' },
    { id: 2, name: 'editor' },
    { id: 3, name: 'viewer' },
  ],
  userRoles: [
    { userId: 1, roleId: 1 },
    { userId: 1, roleId: 2 },
    { userId: 2, roleId: 2 },
    { userId: 3, roleId: 3 },
  ],
}

export const relationConditions = {
  hasMany: new FieldCondition('some', 'projects', new FieldCondition('eq', 'name', 'Audit')),
  belongsTo: new FieldCondition('some', 'user', new FieldCondition('eq', 'name', 'Bob')),
  hasOne: new FieldCondition('some', 'profile', new FieldCondition('eq', 'display_name', 'Alice Profile')),
  manyToMany: new FieldCondition('some', 'roles', new FieldCondition('eq', 'name', 'admin')),
}

export const expectedRelationNames = {
  hasMany: ['Bob'],
  belongsTo: ['Audit'],
  hasOne: ['Alice'],
  manyToMany: ['Alice'],
}

export function namesOf(records: { name: string }[]) {
  return records.map(record => record.name).sort()
}
