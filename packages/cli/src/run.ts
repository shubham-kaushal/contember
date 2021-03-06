#!/usr/bin/env node
import { register } from 'ts-node'
import { CommandManager } from './cli/CommandManager'
import {
	CreateApiKeyCommand,
	InstanceConfigureCommand,
	InstanceCreateCommand,
	InstanceInfoCommand,
	InstanceLogsCommand,
	InstanceReloadAdminCommand,
	InstanceReloadApiCommand,
	InstanceStartCommand,
	InstanceStopCommand,
	InstanceValidateConfigCommand,
	InviteCommand,
	MigrationCreateCommand,
	MigrationDescribeCommand,
	MigrationDiffCommand,
	MigrationExecuteCommand,
	MigrationStatusCommand,
	ProjectCreateCommand,
	ProjectRegisterCommand,
	ProjectValidateCommand,
	SetupCommand,
	SignInCommand,
	WorkspaceCreateCommand,
	WorkspaceUpdateApiCommand,
} from './commands'
import { Application } from './cli'
;(async () => {
	register({
		compilerOptions: {
			experimentalDecorators: true,
			module: 'commonjs',
		},
	})
	const diffCommandFactory = () => new MigrationDiffCommand()
	const migrationsDescribeFactory = () => new MigrationDescribeCommand()
	const commandManager = new CommandManager({
		['migrations:diff']: diffCommandFactory,
		['migrations:describe']: migrationsDescribeFactory,
		['migrations:create']: () => new MigrationCreateCommand(),
		['migrations:execute']: () => new MigrationExecuteCommand(),
		['migrations:status']: () => new MigrationStatusCommand(),
		['workspace:create']: () => new WorkspaceCreateCommand(),
		['workspace:update:api']: () => new WorkspaceUpdateApiCommand(),
		['project:create']: () => new ProjectCreateCommand(),
		['project:register']: () => new ProjectRegisterCommand(),
		['project:validate']: () => new ProjectValidateCommand(),
		['instance:create']: () => new InstanceCreateCommand(),
		['instance:info']: () => new InstanceInfoCommand(),
		['instance:up']: () => new InstanceStartCommand(),
		['instance:configure']: () => new InstanceConfigureCommand(),
		['instance:down']: () => new InstanceStopCommand(),
		['instance:logs']: () => new InstanceLogsCommand(),
		['instance:validate-config']: () => new InstanceValidateConfigCommand(),
		['instance:reload:api']: () => new InstanceReloadApiCommand(),
		['instance:reload:admin']: () => new InstanceReloadAdminCommand(),
		['tenant:setup']: () => new SetupCommand(),
		['tenant:sign-in']: () => new SignInCommand(),
		['tenant:create-api-key']: () => new CreateApiKeyCommand(),
		['tenant:invite']: () => new InviteCommand(),

		// deprecated
		['migrations:dry-run']: migrationsDescribeFactory,
		['diff']: diffCommandFactory,
	})

	const version = process.version.match(/^v?(\d+)\..+$/)
	if (version && Number(version[1]) < 12) {
		throw `Node >= 12 is required`
	}
	const app = new Application(commandManager)
	await app.run(process.argv)
})().catch(e => {
	console.log(e)
	process.exit(1)
})
