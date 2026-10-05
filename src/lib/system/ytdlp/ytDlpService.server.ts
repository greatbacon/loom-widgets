import { env } from '$env/dynamic/private';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

export interface YtDlpDownloadResult {
	filePath: string;
	filename: string;
	contentType: string;
}

const CONTENT_TYPES: Record<string, string> = {
	mp4: 'video/mp4',
	webm: 'video/webm',
	mkv: 'video/x-matroska',
	mov: 'video/quicktime',
	avi: 'video/x-msvideo',
	flv: 'video/x-flv',
	m4a: 'audio/mp4',
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	opus: 'audio/opus'
};

export class YtDlpService {
	constructor(
		private readonly baseDir: string = env.YT_DLP_DOWNLOAD_DIR || '/tmp/yt-dlp',
		private readonly timeoutMs: number = Number(env.YT_DLP_TIMEOUT_MS) || 600_000
	) {}

	private isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	async download(url: string | undefined): Promise<Result<YtDlpDownloadResult> | Error> {
		if (!url || !this.isValidUrl(url)) {
			return { ok: false, error: 'A valid http(s) url is required', code: 400 };
		}

		const dir = path.join(this.baseDir, randomUUID());
		await mkdir(dir, { recursive: true });

		const outputTemplate = path.join(dir, '%(title)s.%(ext)s');

		let stdout: string;
		try {
			const result = await execFileAsync(
				'yt-dlp',
				[
					'--no-playlist',
					'--restrict-filenames',
					'--quiet',
					'--no-warnings',
					'-S',
					'vcodec:h264,acodec:aac,ext:mp4:m4a',
					'--merge-output-format',
					'mp4',
					'-o',
					outputTemplate,
					'--print',
					'after_move:filepath',
					url
				],
				{ timeout: this.timeoutMs }
			);
			stdout = result.stdout;
		} catch (err) {
			console.error('yt-dlp invocation failed:', err);
			return { ok: false, error: 'Failed to download video', code: 502 };
		}

		const filePath = stdout
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.pop();

		if (!filePath) {
			console.error('yt-dlp produced no output file path. stdout was:', stdout);
			return { ok: false, error: 'Failed to download video', code: 502 };
		}

		const filename = path.basename(filePath);
		const ext = path.extname(filename).slice(1).toLowerCase();
		const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

		return { ok: true, data: { filePath, filename, contentType }, code: 200 };
	}
}
