<script lang="ts">
	import { Button } from 'svelte-ux';
</script>

<div class="flex min-h-screen items-center justify-center p-6">
	<div class="w-full max-w-md text-center">
		<h1 class="mb-6 text-2xl font-bold">Welcome</h1>

		<div class="flex justify-center gap-2">
			<Button href="/auth/keycloak/login" variant="fill" color="primary">Sign in with SSO</Button>
		</div>
	</div>
</div>
