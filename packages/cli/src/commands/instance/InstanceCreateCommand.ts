import { Command, CommandConfiguration, Input } from '../../cli'
import { createInstance, validateInstanceName } from '../../utils/instance'

type Args = {
	instanceName: string
}

type Options = {
	template: string
}

export class InstanceCreateCommand extends Command<Args, Options> {
	protected configure(configuration: CommandConfiguration<Args, Options>): void {
		configuration.description('Creates a new Contember instance')
		configuration.argument('instanceName')
		configuration.option('template').valueRequired()
	}

	protected async execute(input: Input<Args, Options>): Promise<void> {
		const [instanceName] = [input.getArgument('instanceName')]
		validateInstanceName(instanceName)
		const workspaceDirectory = process.cwd()
		const template = input.getOption('template')
		await createInstance({ workspaceDirectory, instanceName, template })
		console.log(`Instance ${instanceName} created.`)
	}
}
