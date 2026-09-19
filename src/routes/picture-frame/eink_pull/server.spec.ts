import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	EINK_PULL_ACCESS_TOKEN: 'correct-token'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const handleEinkPull = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { handleEinkPull };
	})
}));

const { GET } = await import('./+server');

const makeRequest = (headers: Record<string, string> = {}, search = '') =>
	new Request(`http://localhost/picture-frame/eink_pull${search}`, { headers });

describe('GET /picture-frame/eink_pull', () => {
	beforeEach(() => {
		mockEnv.EINK_PULL_ACCESS_TOKEN = 'correct-token';
		handleEinkPull.mockReset().mockResolvedValue({ nextCronTime: '2026-01-01T02:00:00Z' });
	});

	it('returns 401 when the X-Access-Token header is missing', async () => {
		await expect(
			GET({
				request: makeRequest(),
				url: new URL('http://localhost/picture-frame/eink_pull')
			} as Parameters<typeof GET>[0])
		).rejects.toMatchObject({ status: 401 });

		expect(handleEinkPull).not.toHaveBeenCalled();
	});

	it('returns 401 when the X-Access-Token header does not match', async () => {
		await expect(
			GET({
				request: makeRequest({ 'X-Access-Token': 'wrong' }),
				url: new URL('http://localhost/picture-frame/eink_pull')
			} as Parameters<typeof GET>[0])
		).rejects.toMatchObject({ status: 401 });

		expect(handleEinkPull).not.toHaveBeenCalled();
	});

	it('returns HTTP 200 (not 204) with the "no image" envelope when the token matches', async () => {
		const response = await GET({
			request: makeRequest({ 'X-Access-Token': 'correct-token' }),
			url: new URL('http://localhost/picture-frame/eink_pull')
		} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: 204,
			message: 'No new image',
			data: { next_cron_time: '2026-01-01T02:00:00Z' }
		});
	});

	it('calls handleEinkPull exactly once on a valid request', async () => {
		await GET({
			request: makeRequest(
				{ 'X-Access-Token': 'correct-token' },
				'?device_id=test&pull_id=abc&battery=80'
			),
			url: new URL('http://localhost/picture-frame/eink_pull?device_id=test&pull_id=abc&battery=80')
		} as Parameters<typeof GET>[0]);

		expect(handleEinkPull).toHaveBeenCalledTimes(1);
	});
});
