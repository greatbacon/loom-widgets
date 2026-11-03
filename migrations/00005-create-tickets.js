export const up = async (sql) => {
	await sql`
		create table if not exists tickets (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			creator_sub text NOT NULL REFERENCES users (sub),
			owner_sub text REFERENCES users (sub),
			title text NOT NULL,
			body text NOT NULL DEFAULT '',
			status text NOT NULL DEFAULT 'backlog',
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
