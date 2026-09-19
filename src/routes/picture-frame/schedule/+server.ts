import { error, json } from '@sveltejs/kit';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';
import type { Bloomin8PullSettingsInput } from '$lib/system/bloomin8/bloomin8Client.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const result = await new PictureFrameService().getUpstreamPullSettings();

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Bloomin8PullSettingsInput;

	const result = await new PictureFrameService().setUpstreamPullSettings(body);

	if (!result.ok) {
		error(result.code, result.error);
	}

	return json(result.data);
};
