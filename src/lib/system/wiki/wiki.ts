export interface WikiCategory {
	name: string;
	parents: string[];
}

export interface WikiArticle {
	title: string;
	text: string;
	nextTitle: string | null;
}
