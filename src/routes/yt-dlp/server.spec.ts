import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';

const download = vi.hoisted(() => vi.fn());
const statMock = vi.hoisted(() => vi.fn());
const createReadStreamMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/system/ytdlp/ytDlpService.server', () => ({
	YtDlpService: vi.fn().mockImplementation(function YtDlpService() {
		return { download };
	})
}));

vi.mock('node:fs/promises', () => ({ stat: statMock }));
vi.mock('node:fs', () => ({ createReadStream: createReadStreamMock }));

const { POST } = await import('./+server');

function requestWith(body: unknown) {
	return {
		request: new Request('http://localhost/yt-dlp', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	} as Parameters<typeof POST>[0];
}

describe('POST /yt-dlp', () => {
	beforeEach(() => {
		download.mockReset();
		statMock.mockReset();
		createReadStreamMock.mockReset();
	});

	it('streams the file back with the expected headers on success', async () => {
		download.mockResolvedValue({
			ok: true,
			data: {
				filePath: '/tmp/yt-dlp/abc/My_Video.mp4',
				filename: 'My_Video.mp4',
				contentType: 'video/mp4'
			},
			code: 200
		});
		statMock.mockResolvedValue({ size: 4 });
		createReadStreamMock.mockReturnValue(Readable.from([Buffer.from('data')]));

		const response = await POST(requestWith({ url: 'https://example.com/watch?v=1' }));

		expect(response.headers.get('Content-Type')).toBe('video/mp4');
		expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="My_Video.mp4"');
		expect(response.headers.get('Content-Length')).toBe('4');
		expect(new TextDecoder().decode(await response.arrayBuffer())).toBe('data');
	});

	it('throws a SvelteKit error when the service returns a non-ok result', async () => {
		download.mockResolvedValue({ ok: false, error: 'A valid http(s) url is required', code: 400 });

		await expect(POST(requestWith({ url: 'not-a-url' }))).rejects.toMatchObject({
			status: 400,
			body: { message: 'A valid http(s) url is required' }
		});
	});
});
