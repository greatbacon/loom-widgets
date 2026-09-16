import { env } from '$env/dynamic/private';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class ProcessedImageStorage {
	constructor(private readonly directory: string = env.PROCESSED_IMAGES_DIR || 'data/processed') {}

	private pathFor(assetId: string): string {
		return path.join(this.directory, `${assetId}.jpg`);
	}

	async write(assetId: string, data: Buffer): Promise<string> {
		const filePath = this.pathFor(assetId);
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, data);
		return filePath;
	}

	async read(filePath: string): Promise<Buffer> {
		return readFile(filePath);
	}
}
