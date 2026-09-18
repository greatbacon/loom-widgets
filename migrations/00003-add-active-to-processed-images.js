export const up = async (sql) => {
	await sql`
		alter table processed_images
		add column active boolean NOT NULL DEFAULT false
	`;
	await sql`
		create unique index processed_images_active_unique_idx
		on processed_images (active)
		where active
	`;
};
