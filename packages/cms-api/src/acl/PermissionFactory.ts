import { Acl, Model } from 'cms-common'
import { getEntity } from '../content-schema/modelUtils'

export default class PermissionFactory {
	constructor(private readonly schema: Model.Schema) {}

	public create(acl: Acl.Schema, roles: string[]): Acl.Permissions {
		let result: Acl.Permissions = {}
		for (let role of roles) {
			const roleDefinition = acl.roles[role]
			let rolePermissions: Acl.Permissions = roleDefinition.entities
			if (roleDefinition.inherits) {
				rolePermissions = this.mergePermissions(this.create(acl, roleDefinition.inherits), rolePermissions)
			}
			result = this.mergePermissions(result, rolePermissions)
		}
		this.makePrimaryPredicatesUnionOfAllFields(result)

		return result
	}

	private makePrimaryPredicatesUnionOfAllFields(permissions: Acl.Permissions): void {
		for (let entityName in permissions) {
			const entity = getEntity(this.schema, entityName)
			const entityPermissions: Acl.EntityPermissions = permissions[entityName]

			const operationNames: (keyof Pick<Acl.EntityOperations, 'create' | 'read'>)[] = ['read', 'create']
			for (let operation of operationNames) {
				const fieldPermissions: Acl.FieldPermissions | undefined = entityPermissions.operations[operation]
				if (fieldPermissions === undefined) {
					continue
				}
				if (Object.values(fieldPermissions).some(it => it === true)) {
					fieldPermissions[entity.primary] = true
				}
				if (fieldPermissions[entity.primary] === true) {
					continue
				}
				const predicateReferences: string[] = Object.entries(fieldPermissions)
					.filter(([key]) => key !== entity.primary)
					.map(([key, value]) => value)
					.filter((value, index, array): value is string => array.indexOf(value) === index)

				let idPermissions: Acl.PredicateReference = fieldPermissions[entity.primary] as Acl.PredicateReference
				const predicates = { ...entityPermissions.predicates }

				for (let predicateReference of predicateReferences) {
					const [predicateDefinition, predicate] = this.mergePredicates(
						predicates,
						idPermissions,
						predicates,
						predicateReference
					)
					if (typeof predicate !== 'string' || predicateDefinition === undefined) {
						throw new Error('should not happen')
					}
					idPermissions = predicate
					predicates[predicate] = predicateDefinition
				}
				fieldPermissions[entity.primary] = idPermissions
				entityPermissions.predicates[idPermissions] = predicates[idPermissions]
			}
		}
	}

	private mergePermissions(left: Acl.Permissions, right: Acl.Permissions): Acl.Permissions {
		const result = { ...left }
		for (let entityName in right) {
			if (result[entityName] !== undefined) {
				result[entityName] = this.mergeEntityPermissions(result[entityName], right[entityName])
			} else {
				result[entityName] = right[entityName]
			}
		}
		return result
	}

	private mergeEntityPermissions(left: Acl.EntityPermissions, right: Acl.EntityPermissions): Acl.EntityPermissions {
		let predicates: Acl.PredicateMap = {}
		const operations: Acl.EntityOperations = {}

		const operationNames: (keyof Pick<Acl.EntityOperations, 'create' | 'read' | 'update'>)[] = [
			'create',
			'read',
			'update',
		]

		for (let operation of operationNames) {
			const leftFieldPermissions: Acl.FieldPermissions = left.operations[operation] || {}
			const rightFieldPermissions: Acl.FieldPermissions = right.operations[operation] || {}
			const [operationPredicates, fieldPermissions] = this.mergeFieldPermissions(
				left.predicates,
				leftFieldPermissions,
				right.predicates,
				rightFieldPermissions
			)
			predicates = { ...predicates, ...operationPredicates }
			if (Object.keys(fieldPermissions).length > 0) {
				operations[operation] = fieldPermissions
			}
		}

		const [predicateDefinition, predicate] = this.mergePredicates(
			left.predicates,
			left.operations.delete,
			right.predicates,
			right.operations.delete
		)
		if (predicate === true) {
			operations.delete = true
		} else if (predicateDefinition !== undefined && typeof predicate === 'string') {
			predicates[predicate] = predicateDefinition
			operations.delete = predicate
		}

		return {
			predicates: predicates,
			operations: operations,
		}
	}

	private mergeFieldPermissions(
		leftPredicates: Acl.PredicateMap,
		leftFieldPermissions: Acl.FieldPermissions,
		rightPredicates: Acl.PredicateMap,
		rightFieldPermissions: Acl.FieldPermissions
	): [Acl.PredicateMap, Acl.FieldPermissions] {
		const fields: Acl.FieldPermissions = {}
		const predicates: Acl.PredicateMap = {}

		for (let field in { ...leftFieldPermissions, ...rightFieldPermissions }) {
			const [predicateDefinition, predicate] = this.mergePredicates(
				leftPredicates,
				leftFieldPermissions[field],
				rightPredicates,
				rightFieldPermissions[field]
			)
			if (predicate === true) {
				fields[field] = true
			} else if (predicateDefinition !== undefined && typeof predicate === 'string') {
				fields[field] = predicate
				predicates[predicate] = predicateDefinition
			}
		}

		return [predicates, fields]
	}

	private mergePredicates(
		leftPredicates: Acl.PredicateMap,
		leftReference: Acl.Predicate | undefined,
		rightPredicates: Acl.PredicateMap,
		rightReference: Acl.Predicate | undefined
	): [Acl.PredicateDefinition, Acl.PredicateReference] | [undefined, boolean] {
		if (leftReference === true || rightReference === true) {
			return [undefined, true]
		}

		if (leftReference !== undefined && rightReference !== undefined) {
			const leftPredicate: Acl.PredicateDefinition = leftPredicates[leftReference]
			const rightPredicate: Acl.PredicateDefinition = rightPredicates[rightReference]
			if (leftPredicate === rightPredicate) {
				return [leftPredicate, leftReference]
			}

			let predicateName = '__merge__' + leftReference + '__' + rightReference
			while (leftPredicates[predicateName]) {
				predicateName += '_'
			}
			return [
				{
					or: [leftPredicate, rightPredicate],
				} as Acl.PredicateDefinition,
				predicateName,
			]
		} else if (leftReference !== undefined) {
			return [leftPredicates[leftReference], leftReference]
		} else if (rightReference !== undefined) {
			let predicateName = rightReference
			if (rightPredicates !== leftPredicates) {
				while (leftPredicates[predicateName]) {
					predicateName += '_'
				}
			}
			return [rightPredicates[rightReference], predicateName]
		} else {
			return [undefined, false]
		}
	}
}