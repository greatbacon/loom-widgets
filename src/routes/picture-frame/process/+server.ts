import { error, json } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		assetId: string;
		crop: { x: number; y: number; width: number; height: number };
	};

	const result = await new PictureFrameService().processAsset(body.assetId, body.crop);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
