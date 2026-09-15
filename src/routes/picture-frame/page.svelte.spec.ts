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

		render(Page);

		const button = page.getByRole('button', { name: 'Push random photo' });
		await button.click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame', { method: 'POST' });
		await expect.element(page.getByText('sunset.jpg')).toBeInTheDocument();
	});
});
