import { describe, it, expect, vi, beforeEach } from 'vitest';

const getDeviceInfo = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { getDeviceInfo };
	})
}));

const { GET } = await import('./+server');

describe('GET /picture-frame/device', () => {
	beforeEach(() => {
		getDeviceInfo.mockReset();
	});

	it('returns the device JSON with status 200 on a successful result', async () => {
		const device = {
			width: 1200,
			height: 1600,
			name: 'Living Room Frame',
			version: '1.2.3',
			type: 'bloomin8',
			battery: 87,
			image: '/gallerys/default/asset-1.jpg'
		};
		getDeviceInfo.mockResolvedValue({ ok: true, data: device, code: 200 });

		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(device);
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		getDeviceInfo.mockResolvedValue({
			ok: false,
			error: 'Failed to fetch device info from Bloomin8 frame',
			code: 502
		});

		await expect(GET({} as Parameters<typeof GET>[0])).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to fetch device info from Bloomin8 frame' }
		});
	});
});
