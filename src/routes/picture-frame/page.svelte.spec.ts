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

		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: null,
				album: null,
				albumError: null
			}
		});

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
				deviceError: null,
				album: null,
				albumError: null
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
				deviceError: 'Failed to fetch device info from Bloomin8 frame',
				album: null,
				albumError: null
			}
		});

		await expect
			.element(page.getByText('Failed to fetch device info from Bloomin8 frame'))
			.toBeInTheDocument();
	});

	it('renders a thumbnail for each asset when data.album is populated', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: null,
				album: {
					albumId: 'album-1',
					albumName: 'Trip',
					assets: [
						{
							id: 'asset-1',
							filename: 'photo.jpg',
							takenAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-1',
							originalUrl: 'http://immich.test/api/assets/asset-1/original'
						},
						{
							id: 'asset-2',
							filename: 'other.jpg',
							takenAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-2',
							originalUrl: 'http://immich.test/api/assets/asset-2/original'
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByAltText('photo.jpg')).toBeInTheDocument();
		await expect.element(page.getByAltText('other.jpg')).toBeInTheDocument();
	});

	it('selecting a thumbnail enables and highlights the "Push selected photo" button', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: null,
				album: {
					albumId: 'album-1',
					albumName: 'Trip',
					assets: [
						{
							id: 'asset-1',
							filename: 'photo.jpg',
							takenAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-1',
							originalUrl: 'http://immich.test/api/assets/asset-1/original'
						}
					]
				},
				albumError: null
			}
		});

		const selectButton = page.getByRole('button', { name: 'Push selected photo' });
		await expect.element(selectButton).toBeDisabled();

		await page.getByAltText('photo.jpg').click();

		await expect.element(selectButton).not.toBeDisabled();
	});

	it('clicking "Push selected photo" POSTs the selected assetId', async () => {
		const fetchStub = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					asset: { id: 'asset-1', filename: 'photo.jpg' },
					device: { width: 1200, height: 1600 },
					path: '/gallerys/default/asset-1.jpg'
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchStub);

		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: null,
				album: {
					albumId: 'album-1',
					albumName: 'Trip',
					assets: [
						{
							id: 'asset-1',
							filename: 'photo.jpg',
							takenAt: '2026-01-01T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-1',
							originalUrl: 'http://immich.test/api/assets/asset-1/original'
						}
					]
				},
				albumError: null
			}
		});

		await page.getByAltText('photo.jpg').click();
		await page.getByRole('button', { name: 'Push selected photo' }).click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ assetId: 'asset-1' })
		});
	});

	it('shows data.albumError when data.album is null and albumError is set', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				device: null,
				deviceError: null,
				album: null,
				albumError: 'Failed to fetch album from Immich'
			}
		});

		await expect.element(page.getByText('Failed to fetch album from Immich')).toBeInTheDocument();
	});
});
