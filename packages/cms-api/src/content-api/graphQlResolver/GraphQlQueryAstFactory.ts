import {
	FieldNode as GraphQlFieldNode,
	GraphQLList,
	GraphQLNonNull,
	GraphQLObjectType,
	GraphQLOutputType,
	GraphQLResolveInfo
} from 'graphql'
import { SelectionSetNode } from 'graphql/language/ast'
import FieldNode from './FieldNode'
import { isIt } from '../../utils/type'
import ObjectNode from './ObjectNode'
import { getArgumentValues } from 'graphql/execution/values'

export default class GraphQlQueryAstFactory {
	public create(info: GraphQLResolveInfo): ObjectNode {
		const node = this.mergeAllFieldNodes(info.fieldNodes)
		const parentType = info.parentType
		if (!(parentType instanceof GraphQLObjectType)) {
			throw new Error(this.getValueType(parentType))
		}

		return this.createFromNode(info, parentType as GraphQLObjectType, node) as ObjectNode
	}

	private mergeAllFieldNodes(fieldNodes: GraphQlFieldNode[]): GraphQlFieldNode {
		const newGraphQlFieldNodes = [...fieldNodes]
		while (newGraphQlFieldNodes.length > 1) {
			newGraphQlFieldNodes.push(
				this.mergeFieldNodes(
					newGraphQlFieldNodes.pop() as GraphQlFieldNode,
					newGraphQlFieldNodes.pop() as GraphQlFieldNode
				)
			)
		}
		return newGraphQlFieldNodes[0]
	}

	private mergeFieldNodes(dest: GraphQlFieldNode, src: GraphQlFieldNode): GraphQlFieldNode {
		return {
			...dest,
			selectionSet: {
				...(dest.selectionSet as SelectionSetNode),
				selections: [
					...(dest.selectionSet ? dest.selectionSet.selections : []),
					...(src.selectionSet ? src.selectionSet.selections : [])
				]
			}
		}
	}

	private createFromNode(
		info: GraphQLResolveInfo,
		parentType: GraphQLObjectType,
		node: GraphQlFieldNode
	): ObjectNode | FieldNode {
		const name = node.name.value
		const field = parentType.getFields()[name]
		const type = field.type
		const alias = node.alias ? node.alias.value : name
		if (!node.selectionSet) {
			return new FieldNode(name, alias)
		}
		const fields: (FieldNode | ObjectNode)[] = []
		for (let subNode of node.selectionSet.selections) {
			if (isIt<GraphQlFieldNode>(subNode, 'kind', 'Field')) {
				fields.push(this.createFromNode(info, this.resolveObjectType(type), subNode))
			} else {
				throw new Error('FragmentSpread and InlineFragment are not supported yet')
			}
		}

		return new ObjectNode(name, alias, fields, getArgumentValues(field, node, info.variableValues))
	}

	private resolveObjectType(type: GraphQLOutputType): GraphQLObjectType {
		if (type instanceof GraphQLObjectType) {
			return type
		}
		if (type instanceof GraphQLList) {
			return this.resolveObjectType(type.ofType)
		}
		if (type instanceof GraphQLNonNull) {
			return this.resolveObjectType(type.ofType)
		}
		throw new Error(this.getValueType(type))
	}

	private getValueType(val: any): string {
		if (typeof val === 'object' && val.constructor) {
			return 'Object of type ' + val.constructor.name + ' is not supported'
		}
		return typeof val + ' is not supported'
	}
}