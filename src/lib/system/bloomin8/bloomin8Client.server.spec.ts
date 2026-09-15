import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEnv = vi.hoisted(() => ({
	BLOOMIN8_URL: 'http://frame.test'
}));

vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

const { Bloomin8Client } = await import('./bloomin8Client.server');

describe('Bloomin8Client', () => {
	beforeEach(() => {
		mockEnv.BLOOMIN8_URL = 'http://frame.test';
		vi.unstubAllGlobals();
	});

	describe('getDeviceInfo', () => {
		it('builds a GET request to {baseUrl}/deviceInfo', async () => {
			const fetchStub = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ width: 1200, height: 1600 }), {
					status: 200
				})
			);
			vi.stubGlobal('fetch', fetchStub);

			const client = new Bloomin8Client();
			await client.getDeviceInfo();

			expect(fetchStub).toHaveBeenCalledWith('http://frame.test/deviceInfo');
		});

		it('returns the parsed JSON body on a 200 response', async () => {
			const deviceInfo = { width: 1200, height: 1600 };
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(JSON.stringify(deviceInfo), { status: 200 }))
			);

			const client = new Bloomin8Client();
			const result = await client.getDeviceInfo();

			expect(result).toEqual(deviceInfo);
		});

		it('throws a descriptive error when the response is non-ok', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(null, { status: 500, statusText: 'Server Error' }))
			);

			const client = new Bloomin8Client();

			await expect(client.getDeviceInfo()).rejects.toThrow(
				'Bloomin8 request failed: 500 Server Error'
			);
		});

		it('propagates a network failure when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

			const client = new Bloomin8Client();

			await expect(client.getDeviceInfo()).rejects.toThrow('network down');
		});
	});

	describe('uploadImage', () => {
		it('builds a POST request with filename and show_now query params and a multipart body', async () => {
			const fetchStub = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ status: 100, path: '/gallerys/default/x.jpg' }), {
					status: 200
				})
			);
			vi.stubGlobal('fetch', fetchStub);

			const client = new Bloomin8Client();
			await client.uploadImage(Buffer.from('bytes'), 'x.jpg', { showNow: true });

			const [url, init] = fetchStub.mock.calls[0];
			expect(url).toBe('http://frame.test/upload?filename=x.jpg&show_now=1');
			expect(init.method).toBe('POST');
			expect(init.body).toBeInstanceOf(FormData);
			expect(init.body.get('image')).toBeInstanceOf(Blob);
		});

		it('includes the gallery query param when provided', async () => {
			const fetchStub = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ status: 100, path: '/gallerys/mine/x.jpg' }), {
					status: 200
				})
			);
			vi.stubGlobal('fetch', fetchStub);

			const client = new Bloomin8Client();
			await client.uploadImage(Buffer.from('bytes'), 'x.jpg', { gallery: 'mine' });

			const [url] = fetchStub.mock.calls[0];
			expect(url).toBe('http://frame.test/upload?filename=x.jpg&gallery=mine');
		});

		it('returns the parsed JSON body on success', async () => {
			const uploadResponse = { status: 100, path: '/gallerys/default/x.jpg' };
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(JSON.stringify(uploadResponse), { status: 200 }))
			);

			const client = new Bloomin8Client();
			const result = await client.uploadImage(Buffer.from('bytes'), 'x.jpg');

			expect(result).toEqual(uploadResponse);
		});

		it('throws a descriptive error when the response is non-ok', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(new Response(null, { status: 400, statusText: 'Bad Request' }))
			);

			const client = new Bloomin8Client();

			await expect(client.uploadImage(Buffer.from('bytes'), 'x.jpg')).rejects.toThrow(
				'Bloomin8 request failed: 400 Bad Request'
			);
		});

		it('propagates a network failure when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

			const client = new Bloomin8Client();

			await expect(client.uploadImage(Buffer.from('bytes'), 'x.jpg')).rejects.toThrow(
				'network down'
			);
		});
	});
});
