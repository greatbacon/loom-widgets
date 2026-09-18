import { Cron } from 'croner';
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

		const cycleResult = await service.cycleActiveAsset();

		if (!cycleResult.ok) {
			log.error('Nightly picture-frame cycle failed:', cycleResult.error);
			return;
		}

		log.debug(`Nightly picture-frame cycle: pushed asset ${cycleResult.data.asset.id}`);
	} finally {
		await sql.end();
	}
}

export function startNightlyPictureFrameScheduler(): void {
	new Cron(
		'0 0 * * *',
		{
			name: 'picture-frame-nightly-batch',
			protect: true,
			catch: (error) =>
				log.error('Nightly picture-frame batch job threw an unhandled error:', error)
		},
		() => {
			void runNightlyPictureFrameBatch();
		}
	);
}
