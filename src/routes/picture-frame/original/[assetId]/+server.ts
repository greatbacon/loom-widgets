import { error } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const result = await new PictureFrameService().getAssetOriginal(params.assetId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return new Response(result.data.data, {
		headers: {
			'Content-Type': result.data.contentType,
			'Cache-Control': 'private, max-age=300'
		}
	});
};
