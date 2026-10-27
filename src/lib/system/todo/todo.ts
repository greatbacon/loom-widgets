export interface TodoList {
	id: string;
	author_sub: string;
	name: string;
	position: number;
	created_at: Date;
	updated_at: Date | null;
}

export interface TodoItem {
	id: string;
	list_id: string;
	author_sub: string;
	content: string;
	position: number;
	completed: boolean;
	created_at: Date;
	updated_at: Date | null;
}

export interface TodoListWithItems extends TodoList {
	items: TodoItem[];
}
