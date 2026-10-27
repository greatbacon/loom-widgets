import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import type { TodoItem, TodoListWithItems } from '$lib/system/todo/todo';

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
});
