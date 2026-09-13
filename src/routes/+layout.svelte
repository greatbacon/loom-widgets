<script lang="ts">
	import './layout.css';
	import { AppBar, AppLayout, NavItem, settings } from 'svelte-ux';
	import { page } from '$app/state';
	import { mdScreen } from '@layerstack/svelte-stores';
	import IconMdiAlphaACircleOutline from '~icons/mdi/alpha-a-circle-outline';
	import IconMdiAlphaBCircleOutline from '~icons/mdi/alpha-b-circle-outline';
	import IconMdiAlphaCCircleOutline from '~icons/mdi/alpha-c-circle-outline';

	let { data, children } = $props();

	const { showDrawer } = settings();

	$effect(() => {
		$showDrawer = $mdScreen;
	});
</script>

{#if data.isAuthenticated}
	<AppLayout>
		<svelte:fragment slot="nav">
			<NavItem
				currentUrl={page.url}
				path="/"
				text="A -- ALPHA"
				class="mt-2 justify-start pl-[2em] font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={IconMdiAlphaACircleOutline}
			/>
			<NavItem
				currentUrl={page.url}
				path="/"
				text="B -- BETA"
				class="mt-2 justify-start pl-[2em] font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={IconMdiAlphaBCircleOutline}
			/>
			<NavItem
				currentUrl={page.url}
				path="/"
				text="C -- CHARLIE"
				class="mt-2 justify-start pl-[2em] font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={IconMdiAlphaCCircleOutline}
			/>
		</svelte:fragment>

		<AppBar title="Loom" class="bg-primary text-primary-content">
			<div slot="actions">
				<a href="/auth/logout">Sign out</a>
			</div>
		</AppBar>

		<main>
			{@render children()}
		</main>
	</AppLayout>
{:else}
	<main>
		{@render children()}
	</main>
{/if}
