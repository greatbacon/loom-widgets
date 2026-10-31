import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import CategoryPicker from './CategoryPicker.svelte';

const categories = [
	{ name: 'Fruit', parents: [] },
	{ name: 'Veg', parents: [] },
	{ name: 'Citrus', parents: ['Fruit'] },
	{ name: 'Lemon', parents: ['Citrus'] },
	{ name: 'Apple', parents: ['Fruit'] },
	{ name: 'Tomato', parents: ['Fruit', 'Veg'] }
];

const btn = (name: string) => page.getByRole('button', { name, exact: true });

describe('CategoryPicker', () => {
	it('shows only roots first', async () => {
		render(CategoryPicker, { categories });

		await expect.element(page.getByRole('button', { name: /^Fruit/ })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Veg/ })).toBeInTheDocument();
		await expect.element(btn('Apple')).not.toBeInTheDocument();
	});

	it('drills into a parent and shows only its children', async () => {
		render(CategoryPicker, { categories });

		await page
			.getByRole('button', { name: /^Fruit/ })
			.first()
			.click();

		await expect.element(btn('Apple')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Citrus/ })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Veg/ })).not.toBeInTheDocument();
	});

	it('does not select a parent', async () => {
		render(CategoryPicker, { categories });

		await page
			.getByRole('button', { name: /^Fruit/ })
			.first()
			.click();

		await expect.element(page.getByText('No category selected')).toBeInTheDocument();
	});

	it('selects a leaf', async () => {
		render(CategoryPicker, { categories });
		await page
			.getByRole('button', { name: /^Fruit/ })
			.first()
			.click();

		await btn('Apple').click();

		await expect.element(page.getByText('Selected: Apple')).toBeInTheDocument();
		await expect.element(btn('Apple')).toHaveAttribute('aria-pressed', 'true');
	});

	it('goes back via the breadcrumb and clears the selection', async () => {
		render(CategoryPicker, { categories });
		await page
			.getByRole('button', { name: /^Fruit/ })
			.first()
			.click();
		await btn('Apple').click();

		await btn('All').click();

		await expect.element(page.getByText('No category selected')).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Veg/ })).toBeInTheDocument();
	});

	it('reaches a multi-parent leaf from either parent', async () => {
		render(CategoryPicker, { categories });
		await page.getByRole('button', { name: /^Veg/ }).click();

		await btn('Tomato').click();

		await expect.element(page.getByText('Selected: Tomato')).toBeInTheDocument();
	});

	it('disables all buttons when disabled', async () => {
		render(CategoryPicker, { categories, disabled: true });

		await expect.element(page.getByRole('button', { name: /^Fruit/ })).toBeDisabled();
		await expect.element(btn('All')).toBeDisabled();
	});
});
