export const up = async (sql) => {
	await sql`
		create table if not exists users (
			sub text primary key,
			iss text NOT NULL,
			username text NOT NULL,
			email text,
			email_verified boolean NOT NULL DEFAULT false,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
