import { Cron, scheduledJobs } from 'croner';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';
import { PictureFrameService } from './pictureFrameService.server';
import { ProcessedImagesRepo } from './processedImagesRepo';

const log = console;

export async function runNightlyPictureFrameBatch(): Promise<void> {
	const sql = postgres(defaultPostgresOptions);
	try {
		const service = new PictureFrameService(undefined, undefined, new ProcessedImagesRepo(sql));
		const result = await service.processUnprocessedAssets();

		if (!result.ok) {
			log.error('Nightly picture-frame batch failed:', result.error);
			return;
		}

		log.debug(
			`Nightly picture-frame batch complete: ${result.data.processedCount} processed, ${result.data.failedCount} failed`
		);
	} finally {
		await sql.end();
	}
}

const JOB_NAME = 'picture-frame-nightly-batch';

export function startNightlyPictureFrameScheduler(): void {
	// Dev HMR re-runs init() with croner's global registry intact, so drop any previous job.
	scheduledJobs.find((job) => job.name === JOB_NAME)?.stop();

	new Cron(
		'0 0 * * *',
		{
			name: JOB_NAME,
			protect: true,
			catch: (error) =>
				log.error('Nightly picture-frame batch job threw an unhandled error:', error)
		},
		() => {
			void runNightlyPictureFrameBatch();
		}
	);
}
