import { Input, Model, Result } from '@contember/schema'
import { assertNever } from '../utils'
import { ValidationResult } from '../input-validation/InputValidator'
import { Client } from '@contember/database'
import Mapper from '../sql/Mapper'
import { InputPreValidator } from '../input-validation/preValidation/InputPreValidator'

export default class ValidationResolver {
	constructor(
		private readonly db: Client,
		private readonly mapperFactory: Mapper.Factory,
		private readonly inputValidator: InputPreValidator,
	) {}

	public async validateUpdate(entity: Model.Entity, input: Input.UpdateInput): Promise<Result.ValidationResult> {
		const mapper = this.mapperFactory(this.db)
		const validationResult = await this.inputValidator.validateUpdate({
			mapper,
			entity,
			where: input.by,
			data: input.data,
			path: [],
		})

		if (validationResult.length > 0) {
			return ValidationResolver.createValidationResponse(validationResult)
		}
		return {
			valid: true,
			errors: [],
		}
	}

	public async validateCreate(entity: Model.Entity, input: Input.CreateInput): Promise<Result.ValidationResult> {
		const mapper = this.mapperFactory(this.db)
		const validationResult = await this.inputValidator.validateCreate({
			mapper,
			entity,
			data: input.data,
			path: [],
			overRelation: null,
		})
		if (validationResult.length > 0) {
			return ValidationResolver.createValidationResponse(validationResult)
		}
		return {
			valid: true,
			errors: [],
		}
	}

	public static createValidationResponse(validationResult: ValidationResult): Result.ValidationResult {
		return {
			valid: false,
			errors: validationResult.map(it => ({
				message: it.message,
				path: it.path.map(part => {
					if ('field' in part) {
						return { __typename: '_FieldPathFragment', ...part }
					}
					if ('index' in part) {
						return { __typename: '_IndexPathFragment', ...part }
					}
					return assertNever(part)
				}),
			})),
		}
	}
}
