import { describe, it, expect, vi, beforeEach } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
	execFile: (
		cmd: string,
		args: string[],
		opts: unknown,
		cb: (err: unknown, result: { stdout: string; stderr: string }) => void
	) => {
		execFileMock(cmd, args, opts)
			.then((result: { stdout: string; stderr: string }) => cb(null, result))
			.catch((err: unknown) => cb(err, { stdout: '', stderr: '' }));
	}
}));

vi.mock('node:fs/promises', () => ({ mkdir: mkdirMock }));

const { YtDlpService } = await import('./ytDlpService.server');

describe('YtDlpService.download', () => {
	beforeEach(() => {
		execFileMock.mockReset();
		mkdirMock.mockReset();
		mkdirMock.mockResolvedValue(undefined);
	});

	it('returns 400 for a missing or invalid url', async () => {
		const service = new YtDlpService('/tmp/yt-dlp-test');

		expect(await service.download(undefined)).toEqual({
			ok: false,
			error: 'A valid http(s) url is required',
			code: 400
		});
		expect(await service.download('not-a-url')).toMatchObject({ ok: false, code: 400 });
		expect(await service.download('ftp://example.com/file')).toMatchObject({
			ok: false,
			code: 400
		});
	});

	it('returns the parsed file path, filename, and content type on success', async () => {
		execFileMock.mockResolvedValue({ stdout: '/tmp/yt-dlp-test/abc/My_Video.mp4\n', stderr: '' });
		const service = new YtDlpService('/tmp/yt-dlp-test');

		const result = await service.download('https://example.com/watch?v=1');

		expect(result).toEqual({
			ok: true,
			data: {
				filePath: '/tmp/yt-dlp-test/abc/My_Video.mp4',
				filename: 'My_Video.mp4',
				contentType: 'video/mp4'
			},
			code: 200
		});
		expect(execFileMock).toHaveBeenCalledWith(
			'yt-dlp',
			expect.arrayContaining([
				'--no-playlist',
				'--print',
				'after_move:filepath',
				'https://example.com/watch?v=1'
			]),
			expect.objectContaining({ timeout: expect.any(Number) })
		);
	});

	it('returns a 502 when the yt-dlp process fails', async () => {
		execFileMock.mockRejectedValue(new Error('exit code 1'));
		const service = new YtDlpService('/tmp/yt-dlp-test');

		expect(await service.download('https://example.com/watch?v=1')).toEqual({
			ok: false,
			error: 'Failed to download video',
			code: 502
		});
	});

	it('returns a 502 when yt-dlp reports no output file', async () => {
		execFileMock.mockResolvedValue({ stdout: '\n', stderr: '' });
		const service = new YtDlpService('/tmp/yt-dlp-test');

		expect(await service.download('https://example.com/watch?v=1')).toEqual({
			ok: false,
			error: 'Failed to download video',
			code: 502
		});
	});

	it('uses audio-extraction args and returns mp3 content type when audioOnly is true', async () => {
		execFileMock.mockResolvedValue({ stdout: '/tmp/yt-dlp-test/abc/My_Song.mp3\n', stderr: '' });
		const service = new YtDlpService('/tmp/yt-dlp-test');

		const result = await service.download('https://example.com/watch?v=1', true);

		expect(result).toEqual({
			ok: true,
			data: {
				filePath: '/tmp/yt-dlp-test/abc/My_Song.mp3',
				filename: 'My_Song.mp3',
				contentType: 'audio/mpeg'
			},
			code: 200
		});
		expect(execFileMock).toHaveBeenCalledWith(
			'yt-dlp',
			expect.arrayContaining(['-x', '--audio-format', 'mp3', '--audio-quality', '0']),
			expect.objectContaining({ timeout: expect.any(Number) })
		);
		expect(execFileMock).not.toHaveBeenCalledWith(
			'yt-dlp',
			expect.arrayContaining(['--merge-output-format']),
			expect.anything()
		);
	});
});
