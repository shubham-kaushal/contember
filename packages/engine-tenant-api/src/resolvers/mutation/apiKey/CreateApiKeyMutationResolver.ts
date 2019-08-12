import { CreateApiKeyResponse, MutationCreateApiKeyArgs, MutationResolvers } from '../../../schema'
import { GraphQLResolveInfo } from 'graphql'
import { ResolverContext } from '../../ResolverContext'
import { PermissionActions, ApiKeyManager } from '../../../'

export class CreateApiKeyMutationResolver implements MutationResolvers {
	constructor(private readonly apiKeyManager: ApiKeyManager) {}

	async createApiKey(
		parent: any,
		{ projects, roles }: MutationCreateApiKeyArgs,
		context: ResolverContext,
		info: GraphQLResolveInfo,
	): Promise<CreateApiKeyResponse> {
		await context.requireAccess({
			action: PermissionActions.API_KEY_CREATE,
			message: 'You are not allowed to create api key',
		})

		const result = await this.apiKeyManager.createPermanentApiKey(
			[...(roles || [])],
			(projects || []).map(it => ({
				variables: [...(it.variables || [])],
				id: it.projectId,
				roles: [...(it.roles || [])],
			})),
		)

		if (!result.ok) {
			return {
				ok: false,
				errors: result.errors.map(errorCode => ({ code: errorCode })),
			}
		}

		return {
			ok: true,
			errors: [],
			result: {
				id: result.result.apiKey.id,
				token: result.result.apiKey.token,
				identity: {
					id: result.result.identityId,
					projects: [],
				},
			},
		}
	}
}