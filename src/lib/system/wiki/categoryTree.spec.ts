import { describe, it, expect } from 'vitest';
import { buildCategoryTree } from './categoryTree';

const c = (name: string, ...parents: string[]) => ({ name, parents });

describe('buildCategoryTree', () => {
	it('builds roots and children from a simple tree', () => {
		const tree = buildCategoryTree([c('Fruit'), c('Apple', 'Fruit'), c('Veg')]);

		expect(tree.roots).toEqual(['Fruit', 'Veg']);
		expect(tree.children.get('Fruit')).toEqual(['Apple']);
		expect(tree.children.has('Apple')).toBe(false);
	});

	it('lists a multi-parent category under each parent', () => {
		const tree = buildCategoryTree([c('A'), c('B'), c('X', 'A', 'B')]);

		expect(tree.children.get('A')).toEqual(['X']);
		expect(tree.children.get('B')).toEqual(['X']);
		expect(tree.roots).toEqual(['A', 'B']);
	});

	it('drops unknown parents, making the child a root', () => {
		const tree = buildCategoryTree([c('Orphan', 'Ghost')]);

		expect(tree.roots).toEqual(['Orphan']);
		expect(tree.children.size).toBe(0);
	});

	it('ignores self-parent entries', () => {
		const tree = buildCategoryTree([c('Loop', 'Loop')]);

		expect(tree.roots).toEqual(['Loop']);
		expect(tree.children.size).toBe(0);
	});

	it('gives a cycle a single root entry point', () => {
		const tree = buildCategoryTree([c('A', 'B'), c('B', 'A')]);

		expect(tree.roots).toEqual(['A']);
		expect(tree.children.get('A')).toEqual(['B']);
	});

	it('sorts roots and children', () => {
		const tree = buildCategoryTree([c('Zed'), c('Alpha'), c('c', 'Zed'), c('B', 'Zed')]);

		expect(tree.roots).toEqual(['Alpha', 'Zed']);
		expect(tree.children.get('Zed')).toEqual(['B', 'c']);
	});
});
