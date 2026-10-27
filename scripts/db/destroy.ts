import postgres from 'postgres';
import { postgresOptions } from './migrate.ts';

export async function destroy() {
	console.log('Running destroy');
	console.log('confirming options');
	console.log(postgresOptions);

	const db = postgres(postgresOptions);

	await db.unsafe(`
            drop schema public cascade;
            create schema public;
            alter schema public owner to postgres;
            grant all on schema public to postgres;
            grant all on schema public to ${postgresOptions.username};
            grant all on schema public to public;
        `);

	await db.end();
}
