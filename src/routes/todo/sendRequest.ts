import { invalidateAll } from '$app/navigation';

export async function sendRequest(
	url: string,
	method: 'PATCH' | 'DELETE',
	body?: Record<string, unknown>
): Promise<string | null> {
	try {
		const response = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			...(body ? { body: JSON.stringify(body) } : {})
		});
		if (!response.ok) {
			return (await response.text()) || `Request failed with status ${response.status}`;
		}
		await invalidateAll();
		return null;
	} catch (err) {
		return err instanceof Error ? err.message : 'Request failed';
	}
}
