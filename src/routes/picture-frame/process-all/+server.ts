import { error, json } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';

export async function POST() {
	const result = await new PictureFrameService().processUnprocessedAssets();

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
}
