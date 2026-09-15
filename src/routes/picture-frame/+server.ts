import { error, json } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';

export async function POST({ request }) {
	const body = await request.text();
	const assetId = body ? (JSON.parse(body) as { assetId?: string }).assetId : undefined;

	const result = await new PictureFrameService().pushAsset(assetId);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
}
