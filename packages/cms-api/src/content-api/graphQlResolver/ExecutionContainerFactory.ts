import Container from '../../core/di/Container'
import { Acl, Model } from 'cms-common'
import JoinBuilder from '../sql/select/JoinBuilder'
import ConditionBuilder from '../sql/select/ConditionBuilder'
import WhereBuilder from '../sql/select/WhereBuilder'
import SelectBuilderFactory from '../sql/select/SelectBuilderFactory'
import InsertBuilderFactory from '../sql/insert/InsertBuilderFactory'
import UpdateBuilderFactory from '../sql/update/UpdateBuilderFactory'
import { Context } from '../types'
import PredicatesInjector from '../../acl/PredicatesInjector'
import VariableInjector from '../../acl/VariableInjector'
import PredicateFactory from '../../acl/PredicateFactory'
import MapperFactory from '../sql/MapperFactory'
import UniqueWhereExpander from './UniqueWhereExpander'
import MapperRunner from '../sql/MapperRunner'
import ReadResolver from './ReadResolver'
import MutationResolver from './MutationResolver'
import JunctionTableManager from '../sql/JunctionTableManager'

class ExecutionContainerFactory {
	constructor(private readonly schema: Model.Schema, private readonly permissions: Acl.Permissions) {}

	public create(context: Context): Container<{ readResolver: ReadResolver; mutationResolver: MutationResolver }> {
		const innerDic = new Container.Builder({})

			.addService('variableInjector', () => new VariableInjector(this.schema, context.identityVariables))
			.addService(
				'predicateFactory',
				({ variableInjector }) => new PredicateFactory(this.permissions, variableInjector)
			)
			.addService('predicatesInjector', ({ predicateFactory }) => new PredicatesInjector(this.schema, predicateFactory))
			.addService('joinBuilder', () => new JoinBuilder(this.schema))
			.addService('conditionBuilder', () => new ConditionBuilder())
			.addService(
				'whereBuilder',
				({ joinBuilder, conditionBuilder }) => new WhereBuilder(this.schema, joinBuilder, conditionBuilder)
			)
			.addService(
				'selectBuilderFactory',
				({ joinBuilder, whereBuilder, predicateFactory }) =>
					new SelectBuilderFactory(this.schema, joinBuilder, whereBuilder, predicateFactory)
			)
			.addService('insertBuilderFactory', ({ whereBuilder }) => new InsertBuilderFactory(this.schema, whereBuilder))
			.addService('updateBuilderFactory', ({ whereBuilder }) => new UpdateBuilderFactory(this.schema, whereBuilder))
			.addService('uniqueWhereExpander', () => new UniqueWhereExpander(this.schema))

			.addService('connectJunctionHandler', ({}) => new JunctionTableManager.JunctionConnectHandler())
			.addService('disconnectJunctionHandler', ({}) => new JunctionTableManager.JunctionDisconnectHandler())
			.addService(
				'junctionTableManager',
				({ uniqueWhereExpander, predicateFactory, whereBuilder, connectJunctionHandler, disconnectJunctionHandler }) =>
					new JunctionTableManager(
						this.schema,
						predicateFactory,
						uniqueWhereExpander,
						whereBuilder,
						connectJunctionHandler,
						disconnectJunctionHandler
					)
			)

			.addService(
				'mapperFactory',
				({
					predicateFactory,
					predicatesInjector,
					selectBuilderFactory,
					insertBuilderFactory,
					updateBuilderFactory,
					uniqueWhereExpander,
					whereBuilder,
					junctionTableManager,
				}) =>
					new MapperFactory(
						this.schema,
						predicateFactory,
						predicatesInjector,
						selectBuilderFactory,
						insertBuilderFactory,
						updateBuilderFactory,
						uniqueWhereExpander,
						whereBuilder,
						junctionTableManager
					)
			)
			.addService('mapperRunner', ({ mapperFactory }) => new MapperRunner(context.db.wrapper(), mapperFactory))

			.addService(
				'readResolver',
				({ mapperRunner, uniqueWhereExpander }) => new ReadResolver(mapperRunner, uniqueWhereExpander)
			)
			.addService(
				'mutationResolver',
				({ mapperRunner, predicatesInjector, uniqueWhereExpander }) =>
					new MutationResolver(mapperRunner, uniqueWhereExpander)
			)

			.build()

		return new Container.Builder({})
			.addService('readResolver', () => innerDic.get('readResolver'))
			.addService('mutationResolver', () => innerDic.get('mutationResolver'))
			.build()
	}
}

export default ExecutionContainerFactory