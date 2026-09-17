import { describe, it, expect, vi, beforeEach } from 'vitest';

const processUnprocessedAssets = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/immich/pictureFrameService.server', () => ({
	PictureFrameService: vi.fn().mockImplementation(function PictureFrameService() {
		return { processUnprocessedAssets };
	})
}));

const { POST } = await import('./+server');

describe('POST /picture-frame/process-all', () => {
	beforeEach(() => {
		processUnprocessedAssets.mockReset();
	});

	it('calls processUnprocessedAssets and returns the resulting counts', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: true,
			data: { processedCount: 2, failedCount: 1 },
			code: 200
		});

		const response = await POST();

		expect(processUnprocessedAssets).toHaveBeenCalled();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ processedCount: 2, failedCount: 1 });
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		processUnprocessedAssets.mockResolvedValue({
			ok: false,
			error: 'Failed to auto-process album assets',
			code: 502
		});

		await expect(POST()).rejects.toMatchObject({
			status: 502,
			body: { message: 'Failed to auto-process album assets' }
		});
	});
});
