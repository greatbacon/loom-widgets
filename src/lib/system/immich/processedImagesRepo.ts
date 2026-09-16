import { Repo } from '$lib/db/repo';
import type { ProcessedImageRow } from '$lib/system/immich/pictureFrame';

const log = console;

export class ProcessedImagesRepo extends Repo {
	async upsert(
		assetId: string,
		filename: string,
		cropX: number,
		cropY: number,
		cropWidth: number,
		cropHeight: number,
		deviceWidth: number,
		deviceHeight: number,
		filePath: string
	): Promise<ProcessedImageRow> {
		log.debug(`[upsert] processed image ${assetId}`);
		const data = await this.sql<ProcessedImageRow[]>`
			INSERT INTO processed_images (
				asset_id, filename, crop_x, crop_y, crop_width, crop_height,
				device_width, device_height, file_path
			)
			VALUES (
				${assetId}, ${filename}, ${cropX}, ${cropY}, ${cropWidth}, ${cropHeight},
				${deviceWidth}, ${deviceHeight}, ${filePath}
			)
			ON CONFLICT (asset_id) DO UPDATE
			SET filename = EXCLUDED.filename,
			    crop_x = EXCLUDED.crop_x,
			    crop_y = EXCLUDED.crop_y,
			    crop_width = EXCLUDED.crop_width,
			    crop_height = EXCLUDED.crop_height,
			    device_width = EXCLUDED.device_width,
			    device_height = EXCLUDED.device_height,
			    file_path = EXCLUDED.file_path,
			    updated_at = now()
			RETURNING asset_id, filename, crop_x, crop_y, crop_width, crop_height,
			          device_width, device_height, file_path, created_at, updated_at
		`;
		return data[0];
	}

	async findByAssetId(assetId: string): Promise<ProcessedImageRow | undefined> {
		const data = await this.sql<ProcessedImageRow[]>`
			SELECT asset_id, filename, crop_x, crop_y, crop_width, crop_height,
			       device_width, device_height, file_path, created_at, updated_at
			FROM processed_images
			WHERE asset_id = ${assetId}
		`;
		return data[0];
	}

	async listAll(): Promise<ProcessedImageRow[]> {
		return this.sql<ProcessedImageRow[]>`
			SELECT asset_id, filename, crop_x, crop_y, crop_width, crop_height,
			       device_width, device_height, file_path, created_at, updated_at
			FROM processed_images
		`;
	}

	async listAssetIds(): Promise<string[]> {
		const data = await this.sql<{ asset_id: string }[]>`
			SELECT asset_id FROM processed_images
		`;
		return data.map((row) => row.asset_id);
	}
}
