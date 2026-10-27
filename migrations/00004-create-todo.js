export const up = async (sql) => {
	await sql`
		create table if not exists todo_lists (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			author_sub text NOT NULL REFERENCES users (sub),
			name text NOT NULL,
			position integer NOT NULL CHECK (position >= 0),
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz,
			CONSTRAINT todo_lists_position_unique UNIQUE (position) DEFERRABLE INITIALLY DEFERRED
		)
	`;
	await sql`
		create table if not exists todo_items (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			list_id uuid NOT NULL REFERENCES todo_lists (id) ON DELETE CASCADE,
			author_sub text NOT NULL REFERENCES users (sub),
			content text NOT NULL,
			position integer NOT NULL CHECK (position >= 0),
			completed boolean NOT NULL DEFAULT false,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz,
			CONSTRAINT todo_items_list_position_unique UNIQUE (list_id, position) DEFERRABLE INITIALLY DEFERRED
		)
	`;
};
