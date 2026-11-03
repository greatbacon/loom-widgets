import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { invalidateAll } from '$app/navigation';
import Page from './+page.svelte';
import type { Ticket } from '$lib/system/tickets/ticket';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));

function stubFetch(respond: () => Response | Promise<Response>) {
	const fetchStub = vi.fn(async () => respond());
	vi.stubGlobal('fetch', fetchStub);
	return fetchStub;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const makeTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
	id: 't-1',
	creator_sub: 'u-1',
	owner_sub: null,
	title: 'Fix bug',
	body: '',
	status: 'backlog',
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

const users = [
	{ sub: 'u-1', username: 'ann' },
	{ sub: 'u-2', username: 'bob' }
];

const makeData = (tickets: Ticket[] = [], error: string | null = null) => ({
	tickets,
	users,
	error
});

describe('/kanban/+page.svelte', () => {
	it('renders four columns with tickets grouped by status and owner names', async () => {
		render(Page, {
			data: makeData([
				makeTicket(),
				makeTicket({ id: 't-2', title: 'Ship it', status: 'done', owner_sub: 'u-2' })
			])
		});

		for (const name of ['Backlog', 'Todo', 'In progress', 'Done']) {
			await expect.element(page.getByRole('region', { name })).toBeInTheDocument();
		}
		const backlog = page.getByRole('region', { name: 'Backlog' });
		const done = page.getByRole('region', { name: 'Done' });
		await expect.element(backlog.getByText('Fix bug')).toBeInTheDocument();
		await expect.element(backlog.getByText('Unassigned')).toBeInTheDocument();
		await expect.element(done.getByText('Ship it')).toBeInTheDocument();
		await expect.element(done.getByText('bob')).toBeInTheDocument();
		await expect.element(done.getByText('Fix bug')).not.toBeInTheDocument();
	});

	it('shows the error paragraph and no board when tickets failed to load', async () => {
		render(Page, { data: makeData([], 'Failed to list tickets') });

		await expect.element(page.getByText('Failed to list tickets')).toBeInTheDocument();
		await expect.element(page.getByRole('region', { name: 'Backlog' })).not.toBeInTheDocument();
	});

	it('creates a ticket', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 201 }));
		render(Page, { data: makeData() });

		await page.getByRole('button', { name: 'New ticket' }).click();
		await page.getByLabelText('Title').fill('Write docs');
		await page.getByRole('button', { name: 'Add ticket' }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith('/kanban', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"title":"Write docs","body":"","status":"backlog","owner_sub":null}'
		});
	});

	it('displays a create error', async () => {
		stubFetch(() => new Response('title is required', { status: 400 }));
		render(Page, { data: makeData() });

		await page.getByRole('button', { name: 'New ticket' }).click();
		await page.getByLabelText('Title').fill('x');
		await page.getByRole('button', { name: 'Add ticket' }).click();

		await expect.element(page.getByText('title is required')).toBeInTheDocument();
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('edits a ticket and PATCHes only the changed fields', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 200 }));
		render(Page, { data: makeData([makeTicket()]) });

		await page.getByRole('button', { name: 'Edit ticket' }).click();
		const title = page.getByLabelText('Title');
		await expect.element(title).toHaveValue('Fix bug');
		await title.fill('Fix the bug');
		await page.getByRole('button', { name: 'Save' }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith(
			'/kanban/t-1',
			expect.objectContaining({ method: 'PATCH', body: '{"title":"Fix the bug"}' })
		);
	});

	it('closes the edit form without fetching when nothing changed', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 200 }));
		render(Page, { data: makeData([makeTicket()]) });

		await page.getByRole('button', { name: 'Edit ticket' }).click();
		await page.getByRole('button', { name: 'Save' }).click();

		await expect.element(page.getByRole('button', { name: 'Edit ticket' })).toBeInTheDocument();
		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('deletes a ticket', async () => {
		const fetchStub = stubFetch(() => new Response(null, { status: 204 }));
		render(Page, { data: makeData([makeTicket()]) });

		await page.getByRole('button', { name: 'Delete ticket' }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith(
			'/kanban/t-1',
			expect.objectContaining({ method: 'DELETE' })
		);
	});

	async function dragCard(title: string, target: string) {
		const card = page.getByRole('group', { name: title }).element();
		const column = page.getByRole('region', { name: target }).element();
		const dataTransfer = new DataTransfer();
		card.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true }));
		column.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true }));
		column.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
	}

	it('PATCHes the status when a card is dropped on another column', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 200 }));
		render(Page, { data: makeData([makeTicket()]) });

		await dragCard('Fix bug', 'In progress');

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith(
			'/kanban/t-1',
			expect.objectContaining({ method: 'PATCH', body: '{"status":"in_progress"}' })
		);
	});

	it('sends no request when a card is dropped on its own column', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 200 }));
		render(Page, { data: makeData([makeTicket()]) });

		await dragCard('Fix bug', 'Backlog');

		expect(fetchStub).not.toHaveBeenCalled();
	});

	it('shows the error when a move fails', async () => {
		stubFetch(() => new Response('Ticket not found', { status: 404 }));
		render(Page, { data: makeData([makeTicket()]) });

		await dragCard('Fix bug', 'Done');

		await expect.element(page.getByText('Ticket not found')).toBeInTheDocument();
	});
});
