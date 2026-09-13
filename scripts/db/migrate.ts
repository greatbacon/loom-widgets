import ley from 'ley';
import 'dotenv/config'
import { spawnSync } from 'child_process';

export const postgresOptions = {
    host: process.env.PGHOST || process.env.POSTGRES_HOST || "",
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE || process.env.POSTGRES_DB || "",
    username: process.env.PGUSER || "",
    password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || "",
    idle_timeout: Number(process.env.PGIDLE_TIMEOUT) || undefined,
    connect_timeout: Number(process.env.PGCONNECT_TIMEOUT) || undefined,
}   

const BACKUP_FILE = 'backup.sql';

export async function migrate(){

	const NODE_ENV = process.env.NODE_ENV;

	const PROD = NODE_ENV === "production"

	//TODO we assume a dev/build step has already occured & look for .js migration files. Fix after gro dev/build replaced.
	const dir = './migrations';

	const status = await ley.status({
		dir,
		driver: 'postgres',
		config: postgresOptions as any,
	});

	if (!status.length) {
		console.log('no migrations to run');
		process.exit(0);
	}

	if (PROD) {
		console.log('backing up db');
		spawnSync('sudo', [
			'-i',
			'-u',
			postgresOptions.username,
			'pg_dump',
			postgresOptions.database,
			'-f',
			BACKUP_FILE,
		]);
	}

	console.log('running migrations: ', status);

	const successes = await ley.up({
		dir,
		driver: 'postgres',
		config: postgresOptions as any,
	});
	console.log('successful migrations:', successes);
	if (successes.length !== status.length) {
		throw Error('not all pending migrations were applied, please double check');
	}
}