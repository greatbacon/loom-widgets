import { env } from '$env/dynamic/private';

export interface Bloomin8DeviceInfo {
	width: number;
	height: number;
	name: string;
	version: string;
	type: string;
	battery: number;
	image: string;
}

export interface Bloomin8UploadResponse {
	status: number;
	path: string;
}

export interface Bloomin8UploadOptions {
	gallery?: string;
	showNow?: boolean;
}

export interface Bloomin8PullSettings {
	upstream_on: boolean;
	upstream_url: string;
	token: string;
	next_cron_time: number;
	pre_image: string;
	time: number;
}

export interface Bloomin8PullSettingsInput {
	upstream_on?: boolean;
	upstream_url?: string;
	token?: string;
	cron_time?: string;
}

export class Bloomin8Client {
	constructor(private readonly baseUrl: string = env.BLOOMIN8_URL!) {}

	async getDeviceInfo(): Promise<Bloomin8DeviceInfo> {
		const response = await fetch(`${this.baseUrl}/deviceInfo`);

		if (!response.ok) {
			throw new Error(`Bloomin8 request failed: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as Bloomin8DeviceInfo;
	}

	async getUpstreamPullSettings(): Promise<Bloomin8PullSettings> {
		const response = await fetch(`${this.baseUrl}/upstream/pull_settings`);

		if (!response.ok) {
			throw new Error(`Bloomin8 request failed: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as Bloomin8PullSettings;
	}

	async setUpstreamPullSettings(settings: Bloomin8PullSettingsInput): Promise<void> {
		const response = await fetch(`${this.baseUrl}/upstream/pull_settings`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(settings)
		});

		if (!response.ok) {
			throw new Error(`Bloomin8 request failed: ${response.status} ${response.statusText}`);
		}
	}

	async uploadImage(
		image: Buffer,
		filename: string,
		options: Bloomin8UploadOptions = {}
	): Promise<Bloomin8UploadResponse> {
		const params = new URLSearchParams({ filename });
		if (options.gallery) params.set('gallery', options.gallery);
		if (options.showNow) params.set('show_now', '1');

		const body = new FormData();
		body.append('image', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), filename);

		const response = await fetch(`${this.baseUrl}/upload?${params.toString()}`, {
			method: 'POST',
			body
		});

		if (!response.ok) {
			throw new Error(`Bloomin8 request failed: ${response.status} ${response.statusText}`);
		}

		return (await response.json()) as Bloomin8UploadResponse;
	}
}
