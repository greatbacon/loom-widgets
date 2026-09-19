import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUpstreamPullSettings = vi.hoisted(() => vi.fn());
const setUpstreamPullSettings = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { getUpstreamPullSettings, setUpstreamPullSettings };
	})
}));

const { GET, PUT } = await import('./+server');

const makeRequest = (body: unknown) =>
	new Request('http://localhost/picture-frame/schedule', {
		method: 'PUT',
		body: JSON.stringify(body)
	});

describe('GET /picture-frame/schedule', () => {
	beforeEach(() => {
		getUpstreamPullSettings.mockReset();
	});

	it('returns the settings JSON with status 200 on a successful result', async () => {
		const settings = {
			upstream_on: true,
			upstream_url: 'http://upstream.test',
			token: 'abc',
			next_cron_time: 1700000000,
			pre_image: '/gallerys/default/x.jpg',
			time: 1700000001
		};
		getUpstreamPullSettings.mockResolvedValue({ ok: true, data: settings, code: 200 });

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(settings);
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		getUpstreamPullSettings.mockResolvedValue({
			ok: false,
			error: 'Failed to fetch upstream pull settings from Bloomin8 frame',
			code: 502
		});

		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to fetch upstream pull settings from Bloomin8 frame' }
		});
	});
});

describe('PUT /picture-frame/schedule', () => {
	beforeEach(() => {
		setUpstreamPullSettings.mockReset();
	});

	it('calls setUpstreamPullSettings with the parsed request body and returns 200', async () => {
		setUpstreamPullSettings.mockResolvedValue({ ok: true, data: null, code: 200 });
		const input = { upstream_on: false, upstream_url: 'http://upstream.test' };

		const response = await PUT({ request: makeRequest(input) } as Parameters<typeof PUT>[0]);

		expect(setUpstreamPullSettings).toHaveBeenCalledWith(input);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(null);
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		setUpstreamPullSettings.mockResolvedValue({
			ok: false,
			error: 'Failed to update upstream pull settings on Bloomin8 frame',
			code: 502
		});

		await expect(
			PUT({ request: makeRequest({ upstream_on: true }) } as Parameters<typeof PUT>[0])
		).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to update upstream pull settings on Bloomin8 frame' }
		});
	});
});
