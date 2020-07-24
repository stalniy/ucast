import { Model } from 'objection'
import Knex from 'knex'

export function setClient(client: string) {
  const knex = Knex({ client })
  Model.knex(knex)
}

export class User extends Model {
  static tableName = 'users'

  static get relationMappings() {
    return {
      projects: {
        relation: Model.HasManyRelation,
        modelClass: Project,
        join: {
          from: 'users.id',
          to: 'projects.user_id'
        }
      }
    }
  }
}
export class Project extends Model {
  static tableName = 'projects'

  static get relationMappings() {
    return {
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'users.id',
          to: 'projects.user_id'
        }
      }
    }
  }
}
