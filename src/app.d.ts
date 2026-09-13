// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="unplugin-icons/types/svelte" />

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		 interface Locals {
			keycloakSubject?: string;
			roles?: string[];
		 }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
