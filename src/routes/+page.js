import { redirect } from '@sveltejs/kit';

export function load() {
	// Redirect dari root "/" langsung ke "/login"
	throw redirect(302, '/login');
}
