import { pathExists } from 'fs-extra'
import { join } from 'path'
import { createInstance } from './instance'
import { createProject, registerProjectToInstance } from './project'
import { readYaml } from './yaml'
import { installTemplate } from './template'
import { resourcesDir } from '../pathUtils'

export const createWorkspace = async ({
	workspaceDirectory,
	withAdmin,
	template,
}: {
	withAdmin: boolean
	workspaceDirectory: string
	template: string
}) => {
	template =
		template ||
		(withAdmin ? '@contember/template-workspace-with-admin' : join(resourcesDir, 'templates/template-workspace'))
	await installTemplate(template, workspaceDirectory, 'workspace')

	const instance = await createInstance({ workspaceDirectory, instanceName: 'default' })
	await createProject({ workspaceDirectory, projectName: 'sandbox' })
	await registerProjectToInstance({ projectName: 'sandbox', ...instance })
}

export interface WorkspaceConfig {
	version?: string
	admin?: {
		enabled?: boolean
	}
}

export const readWorkspaceConfig = async ({
	workspaceDirectory,
}: {
	workspaceDirectory: string
}): Promise<WorkspaceConfig> => {
	const configPath = join(workspaceDirectory, 'contember.workspace.yaml')
	if (!(await pathExists(configPath))) {
		return {}
	}
	return await readYaml(configPath)
}

export const hasInstanceAdmin = async ({ workspaceDirectory }: { workspaceDirectory: string }): Promise<boolean> => {
	const workspaceConfig = await readWorkspaceConfig({ workspaceDirectory })
	return workspaceConfig?.admin?.enabled || false
}