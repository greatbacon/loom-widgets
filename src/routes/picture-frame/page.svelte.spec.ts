import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';

const defaultDeviceInfo = {
	width: 1200,
	height: 1600,
	name: 'Frame',
	version: '1.0',
	type: 'bloomin8',
	battery: 90,
	image: '/gallerys/default/frame.jpg'
};

// The page fetches /picture-frame/device itself on mount, so every test needs
// fetch stubbed (even ones that don't care about the device). Handlers return
// a fresh Response per call, keyed by URL, so onMount's device fetch never
// shares a Response with an action's fetch (sharing one caused "body stream
// already read" once the page fetched device info in addition to the action).
function stubFetch(
	handlers: Record<string, (init?: RequestInit) => Response | Promise<Response>> = {}
) {
	const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
		const handler = handlers[url];
		if (handler) return handler(init);
		if (url === '/picture-frame/device') {
			return new Response(JSON.stringify(defaultDeviceInfo), { status: 200 });
		}
		throw new Error(`Unhandled fetch to ${url}`);
	});
	vi.stubGlobal('fetch', fetchStub);
	return fetchStub;
}

describe('/picture-frame/+page.svelte', () => {
	it('pushes a random photo and shows the result on click', async () => {
		const fetchStub = stubFetch({
			'/picture-frame': () =>
				new Response(
					JSON.stringify({
						asset: { id: 'abc', filename: 'sunset.jpg' },
						device: { width: 1200, height: 1600 },
						path: '/gallerys/default/abc.jpg'
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		const button = page.getByRole('button', { name: 'Push random photo' });
		await button.click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame', { method: 'POST' });
		await expect.element(page.getByText('sunset.jpg')).toBeInTheDocument();
	});

	it('optimistically moves the active badge to the pushed asset without reloading page data', async () => {
		const fetchStub = stubFetch({
			'/picture-frame': () =>
				new Response(
					JSON.stringify({
						asset: { id: 'asset-2', filename: 'other.jpg' },
						device: { width: 1200, height: 1600 },
						path: '/gallerys/default/asset-2-1700000000000.jpg'
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: true
						},
						{
							id: 'asset-2',
							filename: 'other.jpg',
							takenAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-2',
							originalUrl: '/picture-frame/original/asset-2',
							processed: true,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByTitle('Currently on frame')).toBeInTheDocument();

		await page.getByAltText('photo.jpg').click();
		await page.getByRole('button', { name: 'Push selected photo' }).click();

		await expect.element(page.getByText('other.jpg')).toBeInTheDocument();
		expect(fetchStub.mock.calls.filter(([url]) => url === '/picture-frame')).toHaveLength(1);

		const badgeButton = page.getByTitle('Currently on frame').element().closest('button');
		const pushedAssetButton = page.getByAltText('other.jpg').element().closest('button');
		expect(badgeButton).toBe(pushedAssetButton);
	});

	it('disables "Push random photo" when no album assets have been processed', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByRole('button', { name: 'Push random photo' })).toBeDisabled();
	});

	it('shows device info once the device fetch resolves', async () => {
		stubFetch({
			'/picture-frame/device': () =>
				new Response(
					JSON.stringify({
						width: 1200,
						height: 1600,
						name: 'Living Room Frame',
						version: '1.2.3',
						type: 'bloomin8',
						battery: 87,
						image: '/gallerys/default/asset-1-1700000000000.jpg'
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: null
			}
		});

		await expect.element(page.getByText('Living Room Frame (bloomin8)')).toBeInTheDocument();
		await expect
			.element(page.getByText('1200x1600 · Firmware 1.2.3 · Battery 87%'))
			.toBeInTheDocument();
	});

	it('shows an inline error when the device fetch fails', async () => {
		stubFetch({
			'/picture-frame/device': () =>
				new Response('Failed to fetch device info from Bloomin8 frame', { status: 502 })
		});

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: null
			}
		});

		await expect
			.element(page.getByText('Failed to fetch device info from Bloomin8 frame'))
			.toBeInTheDocument();
	});

	it('renders a thumbnail for each asset when data.album is populated', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						},
						{
							id: 'asset-2',
							filename: 'other.jpg',
							takenAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-2',
							originalUrl: '/picture-frame/original/asset-2',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByAltText('photo.jpg')).toBeInTheDocument();
		await expect.element(page.getByAltText('other.jpg')).toBeInTheDocument();
		await expect.element(page.getByTitle('Processed')).not.toBeInTheDocument();
	});

	it('shows a processed indicator only on thumbnails whose asset is processed', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: false
						},
						{
							id: 'asset-2',
							filename: 'other.jpg',
							takenAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-2',
							originalUrl: '/picture-frame/original/asset-2',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByTitle('Processed')).toBeInTheDocument();
	});

	it('shows the active badge only on the thumbnail currently on the frame', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: true
						},
						{
							id: 'asset-2',
							filename: 'other.jpg',
							takenAt: '2026-01-02T00:00:00Z',
							type: 'IMAGE',
							thumbnailUrl: '/picture-frame/thumbnail/asset-2',
							originalUrl: '/picture-frame/original/asset-2',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByTitle('Currently on frame')).toBeInTheDocument();
	});

	it('"Push selected photo" stays disabled selecting an unprocessed thumbnail, but highlights it', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		const selectButton = page.getByRole('button', { name: 'Push selected photo' });
		await expect.element(selectButton).toBeDisabled();

		await page.getByAltText('photo.jpg').click();

		await expect.element(selectButton).toBeDisabled();
	});

	it('"Push selected photo" becomes enabled once the selected asset is processed', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: false
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

	it('clicking "Process" on a selected asset opens the crop editor', async () => {
		stubFetch({
			'/picture-frame/device': () =>
				new Response(
					JSON.stringify({
						width: 1200,
						height: 1600,
						name: 'Frame',
						version: '1.0',
						type: 'bloomin8',
						battery: 90,
						image: '/gallerys/default/asset-1-1700000000000.jpg'
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await page.getByAltText('photo.jpg').click();
		const processButton = page.getByRole('button', { name: 'Process', exact: true });
		await expect.element(processButton).not.toBeDisabled();
		await processButton.click();

		await expect.element(page.getByText('Crop photo')).toBeInTheDocument();
	});

	it('clicking "Push selected photo" POSTs the selected assetId', async () => {
		const fetchStub = stubFetch({
			'/picture-frame': () =>
				new Response(
					JSON.stringify({
						asset: { id: 'asset-1', filename: 'photo.jpg' },
						device: { width: 1200, height: 1600 },
						path: '/gallerys/default/asset-1.jpg'
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: false
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

	it('disables "Process new photos" when every visible asset is already processed', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: true,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await expect.element(page.getByRole('button', { name: 'Process new photos' })).toBeDisabled();
	});

	it('clicking "Process new photos" POSTs to process-all and refreshes the data', async () => {
		const fetchStub = stubFetch({
			'/picture-frame/process-all': () => new Response(JSON.stringify({}), { status: 200 })
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		const button = page.getByRole('button', { name: 'Process new photos' });
		await expect.element(button).not.toBeDisabled();
		await button.click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame/process-all', { method: 'POST' });
	});

	it('shows an inline error when "Process new photos" fails', async () => {
		stubFetch({
			'/picture-frame/process-all': () =>
				new Response('Failed to auto-process album assets', { status: 502 })
		});

		render(Page, {
			data: {
				isAuthenticated: true,
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
							originalUrl: '/picture-frame/original/asset-1',
							processed: false,
							active: false
						}
					]
				},
				albumError: null
			}
		});

		await page.getByRole('button', { name: 'Process new photos' }).click();

		await expect.element(page.getByText('Failed to auto-process album assets')).toBeInTheDocument();
	});

	it('fetches settings and shows the modal pre-filled with the fetched values on "Schedule pull…"', async () => {
		const fetchStub = stubFetch({
			'/picture-frame/schedule': () =>
				new Response(
					JSON.stringify({
						upstream_on: true,
						upstream_url: 'http://upstream.test',
						token: 'secret',
						next_cron_time: 0,
						pre_image: '/gallerys/default/last.jpg',
						time: 1700000000
					}),
					{ status: 200 }
				)
		});

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: null
			}
		});

		await page.getByRole('button', { name: 'Schedule pull…' }).click();

		expect(fetchStub).toHaveBeenCalledWith('/picture-frame/schedule');
		await expect.element(page.getByText('Schedule pull', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Upstream URL')).toHaveValue('http://upstream.test');
	});

	it('saving in the schedule modal PUTs the edited settings and closes the modal', async () => {
		const fetchStub = stubFetch({
			'/picture-frame/schedule': (init) => {
				if (!init) {
					return new Response(
						JSON.stringify({
							upstream_on: true,
							upstream_url: 'http://upstream.test',
							token: 'secret',
							next_cron_time: 0,
							pre_image: '',
							time: 1700000000
						}),
						{ status: 200 }
					);
				}
				return new Response(JSON.stringify(null), { status: 200 });
			}
		});

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: null
			}
		});

		await page.getByRole('button', { name: 'Schedule pull…' }).click();
		await expect.element(page.getByText('Schedule pull', { exact: true })).toBeInTheDocument();

		await page.getByRole('button', { name: 'Save' }).click();

		expect(fetchStub).toHaveBeenCalledWith(
			'/picture-frame/schedule',
			expect.objectContaining({ method: 'PUT' })
		);
		await expect.element(page.getByText('Schedule pull', { exact: true })).not.toBeInTheDocument();
	});

	it('shows an inline error and does not open the modal when fetching settings fails', async () => {
		stubFetch({
			'/picture-frame/schedule': () =>
				new Response('Failed to fetch upstream pull settings from Bloomin8 frame', {
					status: 502
				})
		});

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: null
			}
		});

		await page.getByRole('button', { name: 'Schedule pull…' }).click();

		await expect
			.element(page.getByText('Failed to fetch upstream pull settings from Bloomin8 frame'))
			.toBeInTheDocument();
		await expect.element(page.getByText('Schedule pull', { exact: true })).not.toBeInTheDocument();
	});

	it('shows data.albumError when data.album is null and albumError is set', async () => {
		stubFetch();

		render(Page, {
			data: {
				isAuthenticated: true,
				album: null,
				albumError: 'Failed to fetch album from Immich'
			}
		});

		await expect.element(page.getByText('Failed to fetch album from Immich')).toBeInTheDocument();
	});
});
