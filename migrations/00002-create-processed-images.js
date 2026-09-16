export const up = async (sql) => {
	await sql`
		create table if not exists processed_images (
			asset_id text primary key,
			filename text NOT NULL,
			crop_x integer NOT NULL,
			crop_y integer NOT NULL,
			crop_width integer NOT NULL,
			crop_height integer NOT NULL,
			device_width integer NOT NULL,
			device_height integer NOT NULL,
			file_path text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz
		)
	`;
};
