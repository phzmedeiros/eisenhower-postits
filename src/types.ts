export type QuadrantId = "do" | "schedule" | "delegate" | "eliminate";

export const QUADRANTS: QuadrantId[] = ["do", "schedule", "delegate", "eliminate"];

export const FRONTMATTER_KEY = "eisenhower-plugin";

export interface StickyNote {
	id: string;
	text: string;
	quadrant: QuadrantId;
	done: boolean;
}

export interface Board {
	titles: Record<QuadrantId, string>;
	notes: StickyNote[];
}

export interface PluginSettings {
	showCompleted: boolean;
	newBoardFolder: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	showCompleted: true,
	newBoardFolder: "",
};
