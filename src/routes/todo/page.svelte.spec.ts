import { page, userEvent } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { invalidateAll } from '$app/navigation';
import Page from './+page.svelte';
import type { TodoItem, TodoListWithItems } from '$lib/system/todo/todo';

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

const makeItem = (overrides: Partial<TodoItem> = {}): TodoItem => ({
	id: 'item-1',
	list_id: 'list-1',
	author_sub: 'kc-user-1',
	content: 'milk',
	position: 0,
	completed: false,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	...overrides
});

const makeList = (overrides: Partial<TodoListWithItems> = {}): TodoListWithItems => ({
	id: 'list-1',
	author_sub: 'kc-user-1',
	name: 'Groceries',
	position: 0,
	created_at: new Date('2026-01-01T00:00:00Z'),
	updated_at: null,
	items: [],
	...overrides
});

describe('/todo/+page.svelte', () => {
	it('renders list names and item content', async () => {
		const data = {
			isAuthenticated: true,
			error: null,
			lists: [
				makeList({ items: [makeItem(), makeItem({ id: 'item-2', content: 'eggs', position: 1 })] }),
				makeList({
					id: 'list-2',
					name: 'Chores',
					items: [makeItem({ id: 'item-3', content: 'dishes' })]
				})
			]
		};

		render(Page, { data });

		await expect.element(page.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Chores' })).toBeInTheDocument();
		await expect.element(page.getByText('milk')).toBeInTheDocument();
		await expect.element(page.getByText('eggs')).toBeInTheDocument();
		await expect.element(page.getByText('dishes')).toBeInTheDocument();
	});

	it('checks and strikes through completed items', async () => {
		const data = {
			isAuthenticated: true,
			error: null,
			lists: [
				makeList({
					items: [makeItem({ completed: true }), makeItem({ id: 'item-2', content: 'eggs' })]
				})
			]
		};

		render(Page, { data });

		const checkboxes = page.getByRole('checkbox');
		await expect.element(checkboxes.nth(0)).toBeChecked();
		await expect.element(checkboxes.nth(1)).not.toBeChecked();
		await expect.element(page.getByText('milk')).toHaveClass('line-through');
		await expect.element(page.getByText('eggs')).not.toHaveClass('line-through');
	});

	it('shows a message when there are no lists', async () => {
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });

		await expect.element(page.getByText('No lists yet.')).toBeInTheDocument();
	});

	it('shows a message for a list with no items', async () => {
		render(Page, { data: { isAuthenticated: true, error: null, lists: [makeList()] } });

		await expect.element(page.getByText('No items.')).toBeInTheDocument();
	});

	it('shows the error', async () => {
		render(Page, { data: { isAuthenticated: true, error: 'Failed to list lists', lists: [] } });

		await expect.element(page.getByText('Failed to list lists')).toBeInTheDocument();
		await expect.element(page.getByText('No lists yet.')).not.toBeInTheDocument();
	});

	it('shows the New list form with no lists but not on error', async () => {
		const view = render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });
		await expect.element(page.getByLabelText('New list')).toBeInTheDocument();
		await view.unmount();

		render(Page, { data: { isAuthenticated: true, error: 'boom', lists: [] } });
		await expect.element(page.getByLabelText('New list')).not.toBeInTheDocument();
	});

	it('refreshes the data when the Refresh button is clicked', async () => {
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });
		expect(invalidateAll).not.toHaveBeenCalled();

		await page.getByRole('button', { name: 'Refresh' }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalledTimes(1));
	});

	it('creates a list', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 201 }));
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });

		await page.getByLabelText('New list').fill('Groceries');
		await page.getByRole('button', { name: 'Add list' }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith('/todo/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"name":"Groceries"}'
		});
		await expect.element(page.getByLabelText('New list')).toHaveValue('');
	});

	it('adds an item to a list', async () => {
		const fetchStub = stubFetch(() => new Response('{}', { status: 201 }));
		render(Page, { data: { isAuthenticated: true, error: null, lists: [makeList()] } });

		await page.getByLabelText('Add item').fill('milk');
		await page.getByRole('button', { name: 'Add', exact: true }).click();

		await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(fetchStub).toHaveBeenCalledWith(
			'/todo/lists/list-1/items',
			expect.objectContaining({ body: '{"content":"milk"}' })
		);
	});

	it('disables Add for empty or whitespace input', async () => {
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });
		const button = page.getByRole('button', { name: 'Add list' });

		await expect.element(button).toBeDisabled();
		await page.getByLabelText('New list').fill('   ');
		await expect.element(button).toBeDisabled();
		await page.getByLabelText('New list').fill('x');
		await expect.element(button).toBeEnabled();
	});

	it('shows the server error and keeps the input', async () => {
		stubFetch(() => new Response('name must be a non-empty string', { status: 400 }));
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });

		await page.getByLabelText('New list').fill('x');
		await page.getByRole('button', { name: 'Add list' }).click();

		await expect.element(page.getByText('name must be a non-empty string')).toBeInTheDocument();
		await expect.element(page.getByLabelText('New list')).toHaveValue('x');
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	it('shows a message when fetch rejects', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
		render(Page, { data: { isAuthenticated: true, error: null, lists: [] } });

		await page.getByLabelText('New list').fill('x');
		await page.getByRole('button', { name: 'Add list' }).click();

		await expect.element(page.getByText('network down')).toBeInTheDocument();
	});

	it('keeps item input state separate per list', async () => {
		render(Page, {
			data: {
				isAuthenticated: true,
				error: null,
				lists: [makeList(), makeList({ id: 'list-2', name: 'Chores' })]
			}
		});

		const inputs = page.getByLabelText('Add item');
		await inputs.nth(0).fill('milk');
		await expect.element(inputs.nth(0)).toHaveValue('milk');
		await expect.element(inputs.nth(1)).toHaveValue('');
	});

	describe('item actions', () => {
		const itemUrl = '/todo/lists/list-1/items/item-1';
		const withItem = () => ({
			isAuthenticated: true,
			error: null,
			lists: [makeList({ items: [makeItem()] })]
		});

		it('toggles optimistically and sends PATCH', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 200 }));
			render(Page, { data: withItem() });

			await page.getByRole('checkbox').click();
			await expect.element(page.getByRole('checkbox')).toBeChecked();

			await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
			expect(fetchStub).toHaveBeenCalledWith(itemUrl, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: '{"completed":true}'
			});
		});

		it('reverts the checkbox and shows the error when toggle fails', async () => {
			stubFetch(() => new Response('nope', { status: 400 }));
			render(Page, { data: withItem() });

			await page.getByRole('checkbox').click();

			await expect.element(page.getByText('nope')).toBeInTheDocument();
			await expect.element(page.getByRole('checkbox')).not.toBeChecked();
			expect(invalidateAll).not.toHaveBeenCalled();
		});

		it('reverts the checkbox when fetch rejects', async () => {
			vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
			render(Page, { data: withItem() });

			await page.getByRole('checkbox').click();

			await expect.element(page.getByText('network down')).toBeInTheDocument();
			await expect.element(page.getByRole('checkbox')).not.toBeChecked();
		});

		it('edits an item inline', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 200 }));
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Edit item' }).click();
			const field = page.getByLabelText('Edit item');
			await expect.element(field).toHaveValue('milk');
			await field.fill('oat milk');
			await page.getByRole('button', { name: 'Save' }).click();

			await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
			expect(fetchStub).toHaveBeenCalledWith(
				itemUrl,
				expect.objectContaining({ method: 'PATCH', body: '{"content":"oat milk"}' })
			);
		});

		it('cancels editing with Cancel and Escape without fetching', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 200 }));
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Edit item' }).click();
			await page.getByLabelText('Edit item').fill('changed');
			await page.getByRole('button', { name: 'Cancel' }).click();
			await expect.element(page.getByText('milk')).toBeInTheDocument();

			await page.getByRole('button', { name: 'Edit item' }).click();
			await page.getByLabelText('Edit item').click();
			await userEvent.keyboard('{Escape}');
			await expect.element(page.getByText('milk')).toBeInTheDocument();

			expect(fetchStub).not.toHaveBeenCalled();
		});

		it('disables Save for a blank draft', async () => {
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Edit item' }).click();
			await page.getByLabelText('Edit item').fill('   ');
			await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		});

		it('stays in edit mode and shows the error when save fails', async () => {
			stubFetch(() => new Response('bad content', { status: 400 }));
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Edit item' }).click();
			await page.getByLabelText('Edit item').fill('x');
			await page.getByRole('button', { name: 'Save' }).click();

			await expect.element(page.getByText('bad content')).toBeInTheDocument();
			await expect.element(page.getByLabelText('Edit item')).toHaveValue('x');
			expect(invalidateAll).not.toHaveBeenCalled();
		});

		it('deletes an item', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 204 }));
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Delete item' }).click();

			await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
			expect(fetchStub).toHaveBeenCalledWith(
				itemUrl,
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		it('shows the error when delete fails', async () => {
			stubFetch(() => new Response('gone wrong', { status: 500 }));
			render(Page, { data: withItem() });

			await page.getByRole('button', { name: 'Delete item' }).click();

			await expect.element(page.getByText('gone wrong')).toBeInTheDocument();
			expect(invalidateAll).not.toHaveBeenCalled();
		});
	});

	describe('list actions', () => {
		const listUrl = '/todo/lists/list-1';
		const withList = () => ({ isAuthenticated: true, error: null, lists: [makeList()] });

		it('renames a list', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 200 }));
			render(Page, { data: withList() });

			await page.getByRole('button', { name: 'Rename list' }).click();
			const field = page.getByLabelText('List name');
			await expect.element(field).toHaveValue('Groceries');
			await field.fill('Food');
			await page.getByRole('button', { name: 'Save' }).click();

			await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
			expect(fetchStub).toHaveBeenCalledWith(
				listUrl,
				expect.objectContaining({ method: 'PATCH', body: '{"name":"Food"}' })
			);
		});

		it('cancels renaming with Cancel and Escape without fetching', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 200 }));
			render(Page, { data: withList() });

			await page.getByRole('button', { name: 'Rename list' }).click();
			await page.getByRole('button', { name: 'Cancel' }).click();
			await expect.element(page.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument();

			await page.getByRole('button', { name: 'Rename list' }).click();
			await page.getByLabelText('List name').click();
			await userEvent.keyboard('{Escape}');
			await expect.element(page.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument();

			expect(fetchStub).not.toHaveBeenCalled();
		});

		it('shows the error when rename fails', async () => {
			stubFetch(() => new Response('bad name', { status: 400 }));
			render(Page, { data: withList() });

			await page.getByRole('button', { name: 'Rename list' }).click();
			await page.getByLabelText('List name').fill('x');
			await page.getByRole('button', { name: 'Save' }).click();

			await expect.element(page.getByText('bad name')).toBeInTheDocument();
			expect(invalidateAll).not.toHaveBeenCalled();
		});

		it('deletes a list', async () => {
			const fetchStub = stubFetch(() => new Response(null, { status: 204 }));
			render(Page, { data: withList() });

			await page.getByRole('button', { name: 'Delete list' }).click();

			await vi.waitFor(() => expect(invalidateAll).toHaveBeenCalled());
			expect(fetchStub).toHaveBeenCalledWith(
				listUrl,
				expect.objectContaining({ method: 'DELETE' })
			);
		});

		it('shows the error when delete fails', async () => {
			stubFetch(() => new Response('gone wrong', { status: 500 }));
			render(Page, { data: withList() });

			await page.getByRole('button', { name: 'Delete list' }).click();

			await expect.element(page.getByText('gone wrong')).toBeInTheDocument();
			expect(invalidateAll).not.toHaveBeenCalled();
		});
	});
});
