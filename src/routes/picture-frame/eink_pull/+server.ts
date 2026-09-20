import { error, json } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { PictureFrameService } from '$lib/system/immich/pictureFrameService.server';
import type { RequestHandler } from './$types';

function isValidAccessToken(provided: string | null): boolean {
	const expected = env.EINK_PULL_ACCESS_TOKEN;
	if (!expected || !provided) return false;

	const providedBuf = Buffer.from(provided);
	const expectedBuf = Buffer.from(expected);
	if (providedBuf.length !== expectedBuf.length) return false;

	return timingSafeEqual(providedBuf, expectedBuf);
}

export const GET: RequestHandler = async ({ request, url }) => {
	if (!isValidAccessToken(request.headers.get('x-access-token'))) {
		error(401, 'Invalid or missing access token');
	}

	console.debug(
		'Eink pull received:',
		'device_id=' + url.searchParams.get('device_id'),
		'pull_id=' + url.searchParams.get('pull_id'),
		'battery=' + url.searchParams.get('battery'),
		'time=' + Date.now().toString()
	);

	const { nextCronTime } = await new PictureFrameService().handleEinkPull();

	return json({
		status: 204,
		message: 'No new image',
		data: { next_cron_time: nextCronTime }
	});
};
