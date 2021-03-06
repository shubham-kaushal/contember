import { Schema } from '@contember/schema'
import { GraphQLSchema } from 'graphql'
import { GraphQLObjectsFactory } from '@contember/engine-common'

export interface Identity {
	projectRoles: string[]
}

export type SchemaContext = { schema: Schema; identity: Identity }

export interface GraphQLSchemaContributor {
	createSchema(context: SchemaContext): undefined | GraphQLSchema

	getCacheKey(context: SchemaContext): string
}
