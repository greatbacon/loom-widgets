import { error } from '@sveltejs/kit';

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON body');
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		error(400, 'Invalid JSON body');
	}
	return body as Record<string, unknown>;
}
