import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { YtDlpService } from '$lib/system/ytdlp/ytDlpService.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { url?: string; audioOnly?: boolean };

	const result = await new YtDlpService().download(body.url, body.audioOnly);

	if (!result.ok) {
		error(result.code, result.error);
	}

	const { filePath, filename, contentType } = result.data;
	const { size } = await stat(filePath);
	const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;

	return new Response(stream, {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': String(size)
		}
	});
};
