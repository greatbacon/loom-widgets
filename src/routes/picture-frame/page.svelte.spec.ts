import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

describe('/picture-frame/+page.svelte', () => {
	it('pushes a random photo and shows the result on click', async () => {
		const fetchStub = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					asset: { id: 'abc', filename: 'sunset.jpg' },
					device: { width: 1200, height: 1600 },
					path: '/gallerys/default/abc.jpg'
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchStub);

		render(Page, { data: { isAuthenticated: true, device: null, deviceError: null } });

		const button = page.getByRole('button', { name: 'Push random photo' });
		await button.click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame', { method: 'POST' });
		await expect.element(page.getByText('sunset.jpg')).toBeInTheDocument();
	});

	it('shows device info when data.device is populated', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				device: {
					width: 1200,
					height: 1600,
					name: 'Living Room Frame',
					version: '1.2.3',
					type: 'bloomin8',
					battery: 87
				},
				deviceError: null
			}
		});

		await expect.element(page.getByText('Living Room Frame (bloomin8)')).toBeInTheDocument();
		await expect.element(page.getByText('Firmware 1.2.3 · Battery 87%')).toBeInTheDocument();
	});

	it('shows an inline error when data.deviceError is set', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: 'Failed to fetch device info from Bloomin8 frame'
			}
		});

		await expect
			.element(page.getByText('Failed to fetch device info from Bloomin8 frame'))
			.toBeInTheDocument();
	});
});
