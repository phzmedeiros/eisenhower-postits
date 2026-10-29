import { Board, FRONTMATTER_KEY, QUADRANTS, QuadrantId, StickyNote } from "./types";

const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const HEADING_PATTERN = /^##\s+(.+?)\s*$/;
const ITEM_PATTERN = /^\s*[-*]\s+\[([ xX])\]\s?(.*)$/;
const CONTINUATION_PATTERN = /^(?: {2,}|\t)(.*)$/;
const TAG_PATTERN = /(^|\s)([#@][\p{L}\p{N}_\-/]+)/gu;

export interface NoteParts {
	body: string;
	tags: string[];
}

export function extractTags(text: string): NoteParts {
	const tags: string[] = [];
	const body = text
		.replace(TAG_PATTERN, (_match: string, lead: string, tag: string) => {
			if (!tags.includes(tag)) tags.push(tag);
			return lead;
		})
		.replace(/[ \t]{2,}/g, " ")
		.trim();
	return { body, tags };
}

export function quadrantFor(urgent: boolean, important: boolean): QuadrantId {
	if (urgent && important) return "do";
	if (important) return "schedule";
	if (urgent) return "delegate";
	return "eliminate";
}

export interface ParsedBoard {
	board: Board;
	frontmatter: string;
}

export function emptyBoard(titles: Record<QuadrantId, string>): Board {
	return { titles: { ...titles }, notes: [] };
}

export function parseBoard(data: string, defaultTitles: Record<QuadrantId, string>): ParsedBoard {
	const match = data.match(FRONTMATTER_PATTERN);
	const frontmatter = match ? match[0].replace(/\r?\n$/, "") : "";
	const body = match ? data.slice(match[0].length) : data;

	const board = emptyBoard(defaultTitles);
	let quadrantIndex = -1;
	let current: StickyNote | null = null;

	for (const line of body.split(/\r?\n/)) {
		const heading = line.match(HEADING_PATTERN);
		if (heading) {
			quadrantIndex++;
			current = null;
			if (quadrantIndex < QUADRANTS.length) board.titles[QUADRANTS[quadrantIndex]] = heading[1];
			continue;
		}
		if (quadrantIndex < 0 || quadrantIndex >= QUADRANTS.length) continue;

		const item = line.match(ITEM_PATTERN);
		if (item) {
			current = {
				id: createId(),
				text: item[2].trim(),
				quadrant: QUADRANTS[quadrantIndex],
				done: item[1] !== " ",
			};
			board.notes.push(current);
			continue;
		}

		const continuation = line.match(CONTINUATION_PATTERN);
		if (continuation && current) current.text += "\n" + continuation[1].trim();
	}

	return { board, frontmatter };
}

export function serializeBoard(board: Board, frontmatter: string): string {
	const lines = [frontmatter || defaultFrontmatter(), ""];
	QUADRANTS.forEach((quadrant) => {
		lines.push(`## ${board.titles[quadrant]}`, "");
		const notes = board.notes.filter((note) => note.quadrant === quadrant);
		notes.forEach((note) => {
			const [first, ...rest] = note.text.split("\n");
			lines.push(`- [${note.done ? "x" : " "}] ${first}`);
			rest.forEach((line) => lines.push(`    ${line}`));
		});
		if (notes.length > 0) lines.push("");
	});
	return lines.join("\n").replace(/\n+$/, "") + "\n";
}

export function defaultFrontmatter(): string {
	return `---\n${FRONTMATTER_KEY}: board\n---`;
}

export class BoardModel {
	constructor(public board: Board) {}

	visibleNotes(quadrant: QuadrantId, showCompleted: boolean, tag: string | null = null): StickyNote[] {
		const inQuadrant = this.board.notes.filter(
			(note) => note.quadrant === quadrant && (tag === null || extractTags(note.text).tags.includes(tag))
		);
		const pending = inQuadrant.filter((note) => !note.done);
		if (!showCompleted) return pending;
		return pending.concat(inQuadrant.filter((note) => note.done));
	}

	pendingCount(quadrant: QuadrantId, tag: string | null = null): number {
		return this.visibleNotes(quadrant, false, tag).length;
	}

	allTags(): string[] {
		const tags = new Set<string>();
		this.board.notes.forEach((note) => extractTags(note.text).tags.forEach((tag) => tags.add(tag)));
		return Array.from(tags).sort((a, b) => a.localeCompare(b));
	}

	completedCount(): number {
		return this.board.notes.filter((note) => note.done).length;
	}

	add(quadrant: QuadrantId, text: string): StickyNote {
		const note: StickyNote = { id: createId(), text, quadrant, done: false };
		this.board.notes.push(note);
		return note;
	}

	updateText(id: string, text: string): boolean {
		const note = this.find(id);
		if (!note || note.text === text) return false;
		note.text = text;
		return true;
	}

	toggleDone(id: string): boolean {
		const note = this.find(id);
		if (!note) return false;
		note.done = !note.done;
		return true;
	}

	move(id: string, quadrant: QuadrantId, beforeId: string | null): boolean {
		const notes = this.board.notes;
		const index = notes.findIndex((note) => note.id === id);
		if (index < 0) return false;
		const [note] = notes.splice(index, 1);
		note.quadrant = quadrant;
		const beforeIndex = beforeId && beforeId !== id ? notes.findIndex((other) => other.id === beforeId) : -1;
		if (beforeIndex >= 0) notes.splice(beforeIndex, 0, note);
		else notes.push(note);
		return true;
	}

	remove(id: string): boolean {
		const before = this.board.notes.length;
		this.board.notes = this.board.notes.filter((note) => note.id !== id);
		return this.board.notes.length !== before;
	}

	clearCompleted(): number {
		const before = this.board.notes.length;
		this.board.notes = this.board.notes.filter((note) => !note.done);
		return before - this.board.notes.length;
	}

	renameQuadrant(quadrant: QuadrantId, title: string): boolean {
		const trimmed = title.replace(/\s+/g, " ").trim();
		if (!trimmed || trimmed === this.board.titles[quadrant]) return false;
		this.board.titles[quadrant] = trimmed;
		return true;
	}

	private find(id: string): StickyNote | undefined {
		return this.board.notes.find((note) => note.id === id);
	}
}

function createId(): string {
	return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
