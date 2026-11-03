import type { PageServerLoad } from './$types';
import { TicketsService } from '$lib/system/tickets/ticketsService.server';
import { UsersService } from '$lib/system/users/usersService.server';

export const load: PageServerLoad = async () => {
	const [tickets, users] = await Promise.all([
		new TicketsService().listTickets(),
		new UsersService().listUsers()
	]);

	return {
		tickets: tickets.ok ? tickets.data : [],
		users: users.ok ? users.data.map(({ sub, username }) => ({ sub, username })) : [],
		error: tickets.ok ? (users.ok ? null : users.error) : tickets.error
	};
};
