export interface PersonRow {
	readonly id: string
	readonly password_hash: string
	readonly identity_id: string
	readonly email: string
	readonly roles: string[]
}

export type MaybePersonRow = PersonRow | null
