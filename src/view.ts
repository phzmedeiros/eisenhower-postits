import {
	Component,
	Keymap,
	MarkdownRenderer,
	Menu,
	Notice,
	TFile,
	TextFileView,
	ToggleComponent,
	WorkspaceLeaf,
	normalizePath,
	setIcon,
} from "obsidian";
import { BoardModel, emptyBoard, extractTags, parseBoard, quadrantFor, serializeBoard } from "./board";
import type EisenhowerPostitsPlugin from "./main";
import { ConfirmModal, QuickAddModal } from "./modals";
import { QUADRANTS, QuadrantId, StickyNote } from "./types";

export const VIEW_TYPE_BOARD = "eisenhower-postits-board";

const INVALID_NAME_PATTERN = /[\\/:*?"<>|#^[\]]/;

interface ComposerState {
	open: boolean;
	text: string;
	urgent: boolean | null;
	important: boolean | null;
	error: string | null;
}

export class BoardView extends TextFileView {
	private model: BoardModel;
	private frontmatter = "";
	private unsubscribe: (() => void) | null = null;
	private renderScope: Component | null = null;
	private titleInputEl: HTMLInputElement | null = null;
	private editingId: string | null = null;
	private draggingId: string | null = null;
	private placeholderEl: HTMLElement | null = null;
	private tagFilter: string | null = null;
	private composer: ComposerState = { open: false, text: "", urgent: null, important: null, error: null };

	constructor(leaf: WorkspaceLeaf, private plugin: EisenhowerPostitsPlugin) {
		super(leaf);
		this.model = new BoardModel(emptyBoard(plugin.strings.titles));
	}

	getViewType(): string {
		return VIEW_TYPE_BOARD;
	}

	getDisplayText(): string {
		return this.file?.basename ?? this.plugin.strings.newBoardName;
	}

	getIcon(): string {
		return "layout-grid";
	}

	getViewData(): string {
		return serializeBoard(this.model.board, this.frontmatter);
	}

	setViewData(data: string, clear: boolean): void {
		const parsed = parseBoard(data, this.plugin.strings.titles);
		this.model = new BoardModel(parsed.board);
		this.frontmatter = parsed.frontmatter;
		if (clear) {
			this.editingId = null;
			this.tagFilter = null;
			this.resetComposer(false);
		}
		if (this.editingId === null) this.render();
	}

	clear(): void {
		this.editingId = null;
		this.model = new BoardModel(emptyBoard(this.plugin.strings.titles));
		this.frontmatter = "";
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.onSettingsChange(() => {
			if (this.editingId === null) this.render();
		});
		this.registerDomEvent(this.contentEl, "click", (event) => this.openInternalLink(event));
		this.addAction("file-text", this.plugin.strings.openAsMarkdown, () => void this.plugin.openAsMarkdown(this.leaf));
	}

	async onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		if (this.titleInputEl) this.titleInputEl.value = file.basename;
	}

	quickAdd(quadrant: QuadrantId): void {
		new QuickAddModal(
			this.app,
			`${this.plugin.strings.addToCommand}: ${this.model.board.titles[quadrant]}`,
			this.plugin.strings.quickAddPlaceholder,
			(text) => {
				this.model.add(quadrant, text);
				this.commit();
			}
		).open();
	}

	openComposer(): void {
		this.composer.open = true;
		this.composer.error = null;
		this.render();
		this.focusComposer();
	}

	private commit(): void {
		this.requestSave();
		this.render();
	}

	private render(): void {
		if (this.renderScope) this.removeChild(this.renderScope);
		this.renderScope = this.addChild(new Component());
		this.placeholderEl = null;

		const root = this.contentEl;
		root.empty();
		root.addClass("eisenhower-postits");
		if (this.tagFilter !== null && !this.model.allTags().includes(this.tagFilter)) this.tagFilter = null;

		this.renderToolbar(root);
		if (this.composer.open) this.renderComposer(root);

		const board = root.createDiv({ cls: "ep-board" });
		QUADRANTS.forEach((quadrant) => this.renderQuadrant(board, quadrant));
	}

	private renderToolbar(root: HTMLElement): void {
		const strings = this.plugin.strings;
		const toolbar = root.createDiv({ cls: "ep-toolbar" });

		const title = toolbar.createEl("input", {
			type: "text",
			cls: "ep-title-input",
			attr: { "aria-label": strings.boardTitle, spellcheck: "false" },
		});
		title.value = this.file?.basename ?? "";
		this.titleInputEl = title;
		title.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				title.blur();
			} else if (event.key === "Escape") {
				event.preventDefault();
				title.value = this.file?.basename ?? "";
				title.blur();
			}
		});
		title.addEventListener("blur", () => void this.renameFile(title));

		const actions = toolbar.createDiv({ cls: "ep-toolbar-actions" });

		const toggleWrap = actions.createDiv({ cls: "ep-toggle" });
		new ToggleComponent(toggleWrap)
			.setValue(this.plugin.settings.showCompleted)
			.onChange((value) => this.plugin.setShowCompleted(value));
		const toggleLabel = toggleWrap.createSpan({ text: strings.showCompleted });
		toggleLabel.addEventListener("click", () => this.plugin.setShowCompleted(!this.plugin.settings.showCompleted));

		const filter = actions.createEl("select", { cls: "dropdown ep-tag-filter", attr: { "aria-label": strings.filterByTag } });
		filter.createEl("option", { text: strings.filterByTag, value: "" });
		this.model.allTags().forEach((tag) => filter.createEl("option", { text: displayTag(tag), value: tag }));
		filter.value = this.tagFilter ?? "";
		filter.addEventListener("change", () => {
			this.tagFilter = filter.value || null;
			this.render();
		});

		const clear = actions.createEl("button", {
			cls: "clickable-icon ep-icon-button",
			attr: { "aria-label": strings.clearCompleted },
		});
		setIcon(clear, "eraser");
		clear.addEventListener("click", () => this.confirmClearCompleted());

		const add = actions.createEl("button", { cls: "mod-cta ep-add-global" });
		setIcon(add.createSpan({ cls: "ep-add-global-icon" }), "plus");
		add.createSpan({ text: strings.add });
		add.addEventListener("click", () => {
			if (this.composer.open) this.resetComposer(true);
			else this.openComposer();
		});
	}

	private renderComposer(root: HTMLElement): void {
		const strings = this.plugin.strings;
		const state = this.composer;
		const panel = root.createDiv({ cls: "ep-composer" });

		const input = panel.createEl("textarea", {
			cls: "ep-composer-input",
			attr: { placeholder: strings.quickAddPlaceholder, rows: "2" },
		});
		input.value = state.text;
		input.addEventListener("input", () => {
			state.text = input.value;
			if (state.error) {
				state.error = null;
				panel.querySelector(".ep-composer-error")?.detach();
			}
		});
		input.addEventListener("keydown", (event) => {
			if (event.isComposing) return;
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				this.submitComposer();
			} else if (event.key === "Escape") {
				event.preventDefault();
				this.resetComposer(true);
			}
		});

		this.renderChoice(panel, strings.urgentQuestion, state.urgent, (value) => (state.urgent = value));
		this.renderChoice(panel, strings.importantQuestion, state.important, (value) => (state.important = value));

		if (state.urgent !== null && state.important !== null) {
			const quadrant = quadrantFor(state.urgent, state.important);
			const destination = panel.createDiv({ cls: `ep-composer-destination ep-${quadrant}` });
			destination.createSpan({ cls: "ep-dot" });
			destination.createSpan({ text: `${strings.goesTo}: ${this.model.board.titles[quadrant]}` });
		}

		if (state.error) panel.createDiv({ cls: "ep-composer-error", text: state.error });

		const buttons = panel.createDiv({ cls: "ep-composer-buttons" });
		const cancel = buttons.createEl("button", { text: strings.cancel });
		cancel.addEventListener("click", () => this.resetComposer(true));
		const submit = buttons.createEl("button", { cls: "mod-cta", text: strings.add });
		submit.addEventListener("click", () => this.submitComposer());
	}

	private renderChoice(
		panel: HTMLElement,
		question: string,
		value: boolean | null,
		select: (value: boolean) => void
	): void {
		const strings = this.plugin.strings;
		const row = panel.createDiv({ cls: "ep-choice" });
		row.createSpan({ cls: "ep-choice-label", text: question });
		const chips = row.createDiv({ cls: "ep-chips" });
		[true, false].forEach((option) => {
			const chip = chips.createEl("button", {
				cls: "ep-chip",
				text: option ? strings.yes : strings.no,
				attr: { "aria-pressed": String(value === option) },
			});
			if (value === option) chip.addClass("is-active");
			chip.addEventListener("click", () => {
				select(option);
				this.composer.error = null;
				this.render();
				this.focusComposer();
			});
		});
	}

	private submitComposer(): void {
		const strings = this.plugin.strings;
		const state = this.composer;
		const text = state.text.trim();
		if (!text) state.error = strings.missingText;
		else if (state.urgent === null || state.important === null) state.error = strings.missingChoice;
		if (state.error || state.urgent === null || state.important === null) {
			this.render();
			this.focusComposer();
			return;
		}
		this.model.add(quadrantFor(state.urgent, state.important), text);
		this.resetComposer(false);
		this.commit();
	}

	private resetComposer(rerender: boolean): void {
		this.composer = { open: false, text: "", urgent: null, important: null, error: null };
		if (rerender) this.render();
	}

	private focusComposer(): void {
		window.setTimeout(() => {
			const input = this.contentEl.querySelector<HTMLTextAreaElement>(".ep-composer-input");
			if (!input) return;
			input.focus();
			input.setSelectionRange(input.value.length, input.value.length);
		}, 0);
	}

	private async renameFile(input: HTMLInputElement): Promise<void> {
		const file = this.file;
		if (!file) return;
		const name = input.value.trim();
		if (!name || name === file.basename) {
			input.value = file.basename;
			return;
		}
		if (INVALID_NAME_PATTERN.test(name)) {
			new Notice(this.plugin.strings.invalidName);
			input.value = file.basename;
			return;
		}
		const folder = file.parent && !file.parent.isRoot() ? `${file.parent.path}/` : "";
		const path = normalizePath(`${folder}${name}.${file.extension}`);
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice(this.plugin.strings.nameTaken);
			input.value = file.basename;
			return;
		}
		await this.app.fileManager.renameFile(file, path);
	}

	private confirmClearCompleted(): void {
		const strings = this.plugin.strings;
		const count = this.model.completedCount();
		if (count === 0) {
			new Notice(strings.nothingToClear);
			return;
		}
		new ConfirmModal(this.app, strings.clearConfirm(count), strings.clearCompleted, strings.cancel, () => {
			this.model.clearCompleted();
			this.commit();
		}).open();
	}

	private renderQuadrant(board: HTMLElement, quadrant: QuadrantId): void {
		const strings = this.plugin.strings;
		const box = board.createDiv({ cls: `ep-quadrant ep-${quadrant}` });

		const header = box.createDiv({ cls: "ep-quadrant-header" });
		const titles = header.createDiv({ cls: "ep-quadrant-titles" });
		const titleRow = titles.createDiv({ cls: "ep-quadrant-title-row" });
		const title = titleRow.createSpan({
			cls: "ep-quadrant-title",
			text: this.model.board.titles[quadrant],
			attr: { title: strings.renameQuadrant },
		});
		titleRow.createSpan({ cls: "ep-dot" });
		title.addEventListener("dblclick", () => this.startRenameQuadrant(title, quadrant));
		titles.createDiv({ cls: "ep-quadrant-subtitle", text: `(${strings.subtitles[quadrant]})` });

		const tools = header.createDiv({ cls: "ep-quadrant-tools" });
		tools.createSpan({ cls: "ep-count", text: String(this.model.pendingCount(quadrant, this.tagFilter)) });
		const add = tools.createEl("button", {
			cls: "clickable-icon ep-add",
			attr: { "aria-label": strings.addNote },
		});
		setIcon(add, "plus");
		add.addEventListener("click", () => this.createNote(quadrant));

		const list = box.createDiv({ cls: "ep-list" });
		const notes = this.model.visibleNotes(quadrant, this.plugin.settings.showCompleted, this.tagFilter);
		notes.forEach((note) => this.renderNote(list, note));
		if (notes.length === 0) list.createDiv({ cls: "ep-empty", text: strings.emptyHint });

		list.addEventListener("dblclick", (event) => {
			const target = event.target as HTMLElement;
			if (target === list || target.hasClass("ep-empty")) this.createNote(quadrant);
		});
		this.attachDropZone(list, quadrant);
	}

	private startRenameQuadrant(titleEl: HTMLElement, quadrant: QuadrantId): void {
		const input = createEl("input", { type: "text", cls: "ep-quadrant-title-input" });
		input.value = this.model.board.titles[quadrant];
		titleEl.replaceWith(input);
		input.focus();
		input.select();

		let finished = false;
		const finish = (keep: boolean) => {
			if (finished) return;
			finished = true;
			if (keep && this.model.renameQuadrant(quadrant, input.value)) this.commit();
			else this.render();
		};
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				finish(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				finish(false);
			}
		});
		input.addEventListener("blur", () => finish(true));
	}

	private renderNote(list: HTMLElement, note: StickyNote): void {
		const strings = this.plugin.strings;
		const card = list.createDiv({ cls: "ep-note" });
		card.dataset.id = note.id;
		if (note.done) card.addClass("is-done");

		if (this.editingId === note.id) {
			this.renderEditor(card, note);
			return;
		}

		card.draggable = true;
		const parts = extractTags(note.text);
		const body = card.createDiv({ cls: "ep-note-body" });
		if (this.renderScope && parts.body) {
			void MarkdownRenderer.render(this.app, parts.body, body, this.file?.path ?? "", this.renderScope);
		}
		body.addEventListener("click", (event) => {
			if ((event.target as HTMLElement).closest("a")) return;
			this.startEdit(note.id);
		});

		if (parts.tags.length > 0) {
			const tags = card.createDiv({ cls: "ep-note-tags" });
			parts.tags.forEach((tag) => {
				const chip = tags.createSpan({ cls: "ep-tag", text: displayTag(tag), attr: { title: strings.filterByTag } });
				chip.addEventListener("click", (event) => {
					event.stopPropagation();
					this.tagFilter = this.tagFilter === tag ? null : tag;
					this.render();
				});
			});
		}

		const actions = card.createDiv({ cls: "ep-note-actions" });
		const check = actions.createEl("input", {
			type: "checkbox",
			cls: "ep-check",
			attr: { "aria-label": note.done ? strings.markUndone : strings.markDone },
		});
		check.checked = note.done;
		check.addEventListener("click", (event) => event.stopPropagation());
		check.addEventListener("change", () => {
			if (this.model.toggleDone(note.id)) this.commit();
		});
		const more = actions.createEl("button", {
			cls: "clickable-icon ep-more",
			attr: { "aria-label": strings.more },
		});
		setIcon(more, "more-vertical");
		more.addEventListener("click", (event) => {
			event.stopPropagation();
			this.openMenu(note, event);
		});
		card.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			this.openMenu(note, event);
		});

		card.addEventListener("dragstart", (event) => {
			this.draggingId = note.id;
			if (event.dataTransfer) {
				event.dataTransfer.setData("text/plain", note.text);
				event.dataTransfer.effectAllowed = "move";
				this.setDragGhost(card, note.quadrant, event);
			}
			window.setTimeout(() => card.addClass("is-dragging"), 0);
		});
		card.addEventListener("dragend", () => {
			this.draggingId = null;
			card.removeClass("is-dragging");
			this.clearDropHints();
		});
	}

	private setDragGhost(card: HTMLElement, quadrant: QuadrantId, event: DragEvent): void {
		const wrapper = this.contentEl.createDiv({ cls: `ep-drag-ghost ep-${quadrant}` });
		const clone = card.cloneNode(true) as HTMLElement;
		clone.addClass("is-ghost");
		clone.setCssStyles({ width: `${card.offsetWidth}px` });
		wrapper.appendChild(clone);
		const rect = card.getBoundingClientRect();
		event.dataTransfer?.setDragImage(wrapper, event.clientX - rect.left + 24, event.clientY - rect.top + 24);
		window.setTimeout(() => wrapper.detach(), 0);
	}

	private renderEditor(card: HTMLElement, note: StickyNote): void {
		card.addClass("is-editing");
		const editor = card.createEl("textarea", {
			cls: "ep-editor",
			attr: { placeholder: this.plugin.strings.placeholder, rows: "4" },
		});
		editor.value = note.text;

		let finished = false;
		const finish = (keep: boolean) => {
			if (finished) return;
			finished = true;
			this.editingId = null;
			const text = editor.value.trim();
			if (!keep && note.text.trim()) {
				this.render();
				return;
			}
			if (!text || !keep) {
				this.model.remove(note.id);
				this.commit();
				return;
			}
			if (this.model.updateText(note.id, text)) this.commit();
			else this.render();
		};

		editor.addEventListener("keydown", (event) => {
			if (event.isComposing) return;
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				finish(true);
			} else if (event.key === "Escape") {
				event.preventDefault();
				finish(false);
			}
		});
		editor.addEventListener("blur", () => finish(true));
		window.setTimeout(() => {
			editor.focus();
			editor.setSelectionRange(editor.value.length, editor.value.length);
		}, 0);
	}

	private openMenu(note: StickyNote, event: MouseEvent): void {
		const strings = this.plugin.strings;
		const menu = new Menu();
		menu.addItem((item) => item.setTitle(strings.edit).setIcon("pencil").onClick(() => this.startEdit(note.id)));
		menu.addItem((item) =>
			item
				.setTitle(note.done ? strings.markUndone : strings.markDone)
				.setIcon(note.done ? "rotate-ccw" : "check")
				.onClick(() => {
					if (this.model.toggleDone(note.id)) this.commit();
				})
		);
		menu.addSeparator();
		QUADRANTS.filter((quadrant) => quadrant !== note.quadrant).forEach((quadrant) => {
			menu.addItem((item) =>
				item
					.setTitle(`${strings.moveTo}: ${this.model.board.titles[quadrant]}`)
					.setIcon("arrow-right")
					.onClick(() => {
						if (this.model.move(note.id, quadrant, null)) this.commit();
					})
			);
		});
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(strings.delete)
				.setIcon("trash-2")
				.onClick(() => {
					if (this.model.remove(note.id)) this.commit();
				})
		);
		menu.showAtMouseEvent(event);
	}

	private createNote(quadrant: QuadrantId): void {
		const note = this.model.add(quadrant, "");
		this.startEdit(note.id);
	}

	private startEdit(id: string): void {
		this.editingId = id;
		this.render();
	}

	private attachDropZone(list: HTMLElement, quadrant: QuadrantId): void {
		list.addEventListener("dragover", (event) => {
			if (this.draggingId === null) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
			list.addClass("ep-drop-target");
			this.showPlaceholder(list, this.cardAfterPointer(list, event.clientY, event.clientX));
		});
		list.addEventListener("dragleave", (event) => {
			if (list.contains(event.relatedTarget as Node | null)) return;
			list.removeClass("ep-drop-target");
			this.removePlaceholder();
		});
		list.addEventListener("drop", (event) => {
			if (this.draggingId === null) return;
			event.preventDefault();
			const before = this.cardAfterPointer(list, event.clientY, event.clientX);
			const id = this.draggingId;
			this.draggingId = null;
			if (this.model.move(id, quadrant, before?.dataset.id ?? null)) this.commit();
		});
	}

	private cardAfterPointer(list: HTMLElement, clientY: number, clientX: number): HTMLElement | null {
		const cards = Array.from(list.querySelectorAll<HTMLElement>(".ep-note:not(.is-dragging)"));
		return (
			cards.find((card) => {
				const rect = card.getBoundingClientRect();
				if (clientY < rect.top) return true;
				return clientY <= rect.bottom && clientX < rect.left + rect.width / 2;
			}) ?? null
		);
	}

	private showPlaceholder(list: HTMLElement, before: HTMLElement | null): void {
		if (!this.placeholderEl) this.placeholderEl = createDiv({ cls: "ep-placeholder" });
		const empty = list.querySelector(".ep-empty");
		if (before) list.insertBefore(this.placeholderEl, before);
		else if (empty) list.insertBefore(this.placeholderEl, empty);
		else list.appendChild(this.placeholderEl);
	}

	private removePlaceholder(): void {
		this.placeholderEl?.detach();
	}

	private clearDropHints(): void {
		this.contentEl.querySelectorAll(".ep-drop-target").forEach((el) => el.removeClass("ep-drop-target"));
		this.removePlaceholder();
	}

	private openInternalLink(event: MouseEvent): void {
		const link = (event.target as HTMLElement).closest("a.internal-link");
		if (!link) return;
		event.preventDefault();
		event.stopPropagation();
		const target = link.getAttribute("data-href") ?? link.getAttribute("href");
		if (target) void this.app.workspace.openLinkText(target, this.file?.path ?? "", Keymap.isModEvent(event));
	}
}

function displayTag(tag: string): string {
	return tag.startsWith("#") ? tag.slice(1) : tag;
}
