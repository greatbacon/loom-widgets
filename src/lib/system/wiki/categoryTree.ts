import type { WikiCategory } from './wiki';

export interface CategoryTree {
	roots: string[];
	children: Map<string, string[]>; // parent -> sorted child names
}

const byName = (a: string, b: string) => a.localeCompare(b);

export function buildCategoryTree(categories: WikiCategory[]): CategoryTree {
	const known = new Set(categories.map((c) => c.name));
	const childSets = new Map<string, Set<string>>();
	const rootSet = new Set<string>();

	for (const { name, parents } of categories) {
		const validParents = parents.filter((p) => p !== name && known.has(p));
		if (validParents.length === 0) rootSet.add(name);
		for (const parent of validParents) {
			const set = childSets.get(parent) ?? new Set<string>();
			set.add(name);
			childSets.set(parent, set);
		}
	}

	const children = new Map<string, string[]>();
	for (const [parent, set] of childSets) children.set(parent, [...set].sort(byName));

	const roots = [...rootSet].sort(byName);

	// Cycle-only nodes are unreachable from any root; add one entry point per cycle.
	const reachable = new Set<string>();
	const visit = (start: string) => {
		const stack = [start];
		while (stack.length) {
			const name = stack.pop()!;
			if (reachable.has(name)) continue;
			reachable.add(name);
			stack.push(...(children.get(name) ?? []));
		}
	};
	roots.forEach(visit);
	for (const name of [...known].sort(byName)) {
		if (!reachable.has(name)) {
			roots.push(name);
			visit(name);
		}
	}

	return { roots, children };
}
