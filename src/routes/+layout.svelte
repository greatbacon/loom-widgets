<script lang="ts">
	import './layout.css';
	import { AppBar, AppLayout, NavItem, settings } from 'svelte-ux';
	import { page } from '$app/state';
	import { mdScreen } from '@layerstack/svelte-stores';
	import IconMdiImageFrame from '~icons/mdi/image-frame';

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
				path="/picture-frame"
				text="Picture Frame"
				class="mt-2 justify-start pl-[2em] font-bold transition-shadow duration-200 hover:shadow-[0_0_10px_var(--color-primary)]"
				icon={IconMdiImageFrame}
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
