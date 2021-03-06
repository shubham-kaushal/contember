import 'jasmine'
import { Client, ConflictActionType, LimitByGroupWrapper, LockType, Operator } from '../../../src'
import { createConnectionMock } from '@contember/database-tester'
import { SQL } from '../../src/tags'

interface Test {
	query: (wrapper: Client) => void
	sql: string
	parameters: any[]
}

const execute = async (test: Test) => {
	const connection = createConnectionMock(
		[
			{
				sql: test.sql,
				parameters: test.parameters,
				response: { rows: [] },
			},
		],
		(expected, actual, message) => expect(actual).toEqual(expected, message),
	)
	const wrapper = new Client(connection, 'public', {})

	await test.query(wrapper)
}

describe('query builder', () => {
	it('constructs condition', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.from('foo')
					.where(cond =>
						cond
							.compare('a', Operator.eq, 1)
							.compare('b', Operator.notEq, 2)
							.compare('c', Operator.lt, 3)
							.compare('d', Operator.lte, 4)
							.compare('e', Operator.gt, 5)
							.compare('f', Operator.gte, 6)
							.compare('g', Operator.contains, 'foo\\%bar')
							.compare('h', Operator.startsWith, 'lorem_ipsum')
							.compare('i', Operator.endsWith, 'dolor%sit')
							.compareColumns('z', Operator.eq, ['foo', 'x'])
							.in('o', [1, 2, 3])
							.in(
								'm',
								wrapper.selectBuilder().select(expr => expr.selectValue(1)),
							)
							.null('n')
							.raw('false'),
					)

				await qb.getResult(wrapper)
			},
			sql: SQL`select *
               from "public"."foo"
               where "a" = ? and "b" != ? and "c" < ? and "d" <= ? and "e" > ? and "f" >= ?
                     and "g" like '%' || ? || '%' and "h" like ? || '%' and "i" like '%' || ?
                     and "z" = "foo"."x" and "o" in (?, ?, ?) and "m" in (select ?) and "n" is null and false`,
			parameters: [1, 2, 3, 4, 5, 6, 'foo\\\\\\%bar', 'lorem\\_ipsum', 'dolor\\%sit', 1, 2, 3, 1],
		})
	})

	it('constructs "on"', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.select(['foo', 'id'])
					.from('foo')
					.join('bar', 'bar', clause =>
						clause
							.or(clause =>
								clause
									.compare(['bar', 'a'], Operator.eq, 1)
									.compare(['bar', 'a'], Operator.eq, 2)
									.not(clause => clause.compare(['bar', 'b'], Operator.eq, 1)),
							)
							.and(clause =>
								clause
									.in(['bar', 'c'], [1, 2, 3])
									.null(['bar', 'd'])
									.not(clause => clause.null(['bar', 'd']))
									.compareColumns(['bar', 'e'], Operator.lte, ['bar', 'f']),
							),
					)
				await qb.getResult(wrapper)
			},
			sql: SQL`select "foo"."id"
               from "public"."foo"
                 inner join "public"."bar" as "bar"
                   on ("bar"."a" = ? or "bar"."a" = ? or not("bar"."b" = ?)) and "bar"."c" in (?, ?, ?) and "bar"."d" is null and not("bar"."d" is null)
                      and "bar"."e" <= "bar"."f"`,
			parameters: [1, 2, 1, 1, 2, 3],
		})
	})

	it('constructs simple insert', async () => {
		await execute({
			query: async wrapper => {
				const builder = wrapper
					.insertBuilder()
					.into('author')
					.values({
						id: 1,
						title: 'foo',
						content: expr => expr.selectValue('bar'),
					})
				await builder.execute(wrapper)
			},
			sql: SQL`insert into "public"."author" ("id", "title", "content") values (?, ?, ?)`,
			parameters: [1, 'foo', 'bar'],
		})
	})

	it('constructs insert with cte', async () => {
		await execute({
			query: async wrapper => {
				const builder = wrapper
					.insertBuilder()
					.with('root_', qb => {
						return qb
							.select(expr => expr.selectValue('Hello', 'text'), 'title')
							.select(expr => expr.selectValue(1, 'int'), 'id')
							.select(expr => expr.selectValue(null, 'text'), 'content')
					})
					.into('author')
					.values({
						id: expr => expr.select('id'),
						title: expr => expr.select('title'),
					})
					.from(qb => {
						return qb.from('root_')
					})
					.returning('id')
					.onConflict(ConflictActionType.doNothing)
				await builder.execute(wrapper)
			},
			sql: SQL`
				with "root_" as (select ? :: text as "title", ? :: int as "id", ? :: text as "content")
				insert into "public"."author" ("id", "title")
					select "id", "title" from "root_"
        on conflict do nothing returning "id"`,
			parameters: ['Hello', 1, null],
		})
	})

	it('constructs insert with on conflict update', async () => {
		await execute({
			query: async wrapper => {
				const builder = wrapper
					.insertBuilder()
					.into('author')
					.values({
						id: expr => expr.selectValue('123'),
						title: expr => expr.select('title'),
					})
					.from(qb => {
						return qb.from('foo')
					})
					.returning('id')
					.onConflict(ConflictActionType.update, ['id'], {
						id: expr => expr.selectValue('123'),
						title: expr => expr.select('title'),
					})
				await builder.execute(wrapper)
			},
			sql: SQL`insert into "public"."author" ("id", "title")
        select
          ?,
          "title"
        from "public"."foo"
      on conflict ("id") do update set "id" = ?, "title" = "title" returning "id"`,
			parameters: ['123', '123'],
		})
	})

	it('constructs insert with on conflict do nothing', async () => {
		await execute({
			query: async wrapper => {
				const builder = wrapper
					.insertBuilder()
					.into('author')
					.values({
						id: expr => expr.selectValue('123'),
					})
					.onConflict(ConflictActionType.doNothing, { constraint: 'bar' })
				await builder.execute(wrapper)
			},
			sql: SQL`insert into "public"."author" ("id")
			         values (?)
			         on conflict on constraint "bar" do nothing`,
			parameters: ['123'],
		})
	})

	it('constructs simple update', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.updateBuilder()
					.table('author')
					.values({
						title: 'Hello',
					})
					.where({ id: 12 })
				await qb.execute(wrapper)
			},
			sql: SQL`update "public"."author"
      set "title" = ?
      where "id" = ?`,
			parameters: ['Hello', 12],
		})
	})

	it('constructs update with cte', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.updateBuilder()
					.with('root_', qb => {
						return qb
							.select(expr => expr.selectValue('Hello', 'text'), 'title')
							.select(expr => expr.selectValue(1, 'int'), 'id')
							.select(expr => expr.selectValue(null, 'text'), 'content')
					})
					.table('author')
					.values({
						id: expr => expr.select(['root_', 'id']),
						title: expr => expr.select(['root_', 'title']),
					})
					.from(qb => {
						return qb.from('root_').where({ foo: 'bar' })
					})
					.where({ id: 12 })
				await qb.execute(wrapper)
			},
			sql: SQL`with "root_" as (select
                                  ? :: text as "title",
                                  ? :: int as "id",
                                  ? :: text as "content") update "public"."author"
      set "id" = "root_"."id", "title" = "root_"."title" from "root_"
      where "foo" = ? and "id" = ?`,
			parameters: ['Hello', 1, null, 'bar', 12],
		})
	})

	it('constructs select with condition', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.select(
						expr =>
							expr.selectCondition(condition =>
								condition.or(condition => condition.compare('foo', Operator.gte, 1).compare('foo', Operator.lte, 0)),
							),
						'bar',
					)
				await qb.getResult(wrapper)
			},
			sql: SQL`select ("foo" >= ? or "foo" <= ?) as "bar"`,
			parameters: [1, 0],
		})
	})

	it('constructs delete', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.deleteBuilder()
					.with('data', qb => qb.from('abc'))
					.from('bar')
					.using('data')
					.where(cond => cond.compare(['data', 'a'], Operator.gte, 1))
					.returning('xyz')
				await qb.execute(wrapper)
			},
			sql: SQL`with "data" as
			(select * from "public"."abc")
			delete from "public"."bar"
			using "data" as "data"
			where "data"."a" >= ? returning "xyz"`,
			parameters: [1],
		})
	})

	it('constructs window function', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper.selectBuilder().select(expr =>
					expr.window(window =>
						window
							.orderBy(['foo', 'bar'], 'desc')
							.rowNumber()
							.partitionBy(['lorem', 'ipsum']),
					),
				)

				await qb.getResult(wrapper)
			},
			sql: SQL`select row_number()
      over(partition by "lorem"."ipsum"
        order by "foo"."bar" desc)`,
			parameters: [],
		})
	})

	it('applies limit by group', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.select(['foo', 'bar'])
					.from('foo')

				await new LimitByGroupWrapper(
					['foo', 'lorem'],
					(orderable, qb) => {
						if (orderable) {
							return [orderable.orderBy(['foo', 'ipsum']), qb.orderBy(['foo', 'ipsum'])]
						}
						return [null, qb.orderBy(['foo', 'ipsum'])]
					},
					1,
					3,
				).getResult(qb, wrapper)
			},
			sql: SQL`with "data" as
			(select "foo"."bar",
				 row_number() over(partition by "foo"."lorem" order by "foo"."ipsum" asc) as "rowNumber_"
			 from "public"."foo" order by "foo"."ipsum" asc)
			select "data".* from "data" where "data"."rowNumber_" > ? and "data"."rowNumber_" <= ?`,
			parameters: [1, 4],
		})
	})

	it('select with no key update', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.select('id')
					.from('foo')
					.lock(LockType.forNoKeyUpdate)

				await qb.getResult(wrapper)
			},
			sql: SQL`select "id" from "public"."foo" for no key update`,
			parameters: [],
		})
	})

	it('select union', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.select('id')
					.from('foo')
					.unionAll(qb => qb.select('id').from('bar'))

				await qb.getResult(wrapper)
			},
			sql: SQL`select "id" from "public"."foo" union all ( select "id" from "public"."bar")`,
			parameters: [],
		})
	})

	it('select with recursive', async () => {
		await execute({
			query: async wrapper => {
				const qb = wrapper
					.selectBuilder()
					.withRecursive('recent_events', qb =>
						qb
							.select('id')
							.from('events')
							.where({ id: '123' })
							.unionAll(qb =>
								qb
									.select('id')
									.from('events')
									.from('recent_events')
									.where(expr => expr.columnsEq(['events', 'id'], ['recent_events', 'previous_id'])),
							),
					)
					.select('id')
					.from('recent_events')

				await qb.getResult(wrapper)
			},
			sql: SQL`
			with recursive
     			"recent_events" as (select "id" from "public"."events" where "id" = ?
					union all ( select "id" from "public"."events", "recent_events" where "events"."id" = "recent_events"."previous_id"))
			select "id" from "recent_events"`,
			parameters: ['123'],
		})
	})
})
