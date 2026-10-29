import { MarkdownView, Plugin, TFile, TFolder, ViewState, WorkspaceLeaf, normalizePath } from "obsidian";
import { emptyBoard, serializeBoard } from "./board";
import { Strings, getStrings } from "./i18n";
import { EisenhowerSettingTab } from "./settings";
import { DEFAULT_SETTINGS, FRONTMATTER_KEY, PluginSettings, QUADRANTS } from "./types";
import { BoardView, VIEW_TYPE_BOARD } from "./view";

export default class EisenhowerPostitsPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	strings: Strings = getStrings();
	private settingsListeners = new Set<() => void>();
	private markdownLeaves = new WeakMap<WorkspaceLeaf, string>();
	private switchingLeaves = new WeakSet<WorkspaceLeaf>();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_BOARD, (leaf) => new BoardView(leaf, this));
		this.addRibbonIcon("layout-grid", this.strings.newBoard, () => void this.createBoard());

		this.addCommand({
			id: "create-matrix",
			name: this.strings.newBoard,
			callback: () => void this.createBoard(),
		});

		this.addCommand({
			id: "toggle-matrix-view",
			name: this.strings.toggleView,
			checkCallback: (checking) => {
				const leaf = this.app.workspace.getMostRecentLeaf();
				if (!leaf) return false;
				const view = leaf.view;
				if (view instanceof BoardView) {
					if (!checking) void this.openAsMarkdown(leaf);
					return true;
				}
				if (view instanceof MarkdownView && view.file && this.isBoardFile(view.file)) {
					if (!checking) void this.openAsBoard(leaf);
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: "add-sticky-note",
			name: this.strings.addCommand,
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(BoardView);
				if (!view) return false;
				if (!checking) view.openComposer();
				return true;
			},
		});

		QUADRANTS.forEach((quadrant) => {
			this.addCommand({
				id: `add-to-${quadrant}`,
				name: `${this.strings.addToCommand}: ${this.strings.titles[quadrant]}`,
				checkCallback: (checking) => {
					const view = this.app.workspace.getActiveViewOfType(BoardView);
					if (!view) return false;
					if (!checking) view.quickAdd(quadrant);
					return true;
				},
			});
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, _source, leaf) => {
				if (file instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle(this.strings.newBoardInFolder)
							.setIcon("layout-grid")
							.onClick(() => void this.createBoard(file))
					);
					return;
				}
				if (!(file instanceof TFile) || !leaf || !this.isBoardFile(file)) return;
				if (leaf.view instanceof BoardView) {
					menu.addItem((item) =>
						item
							.setTitle(this.strings.openAsMarkdown)
							.setIcon("file-text")
							.onClick(() => void this.openAsMarkdown(leaf))
					);
				} else if (leaf.view instanceof MarkdownView) {
					menu.addItem((item) =>
						item
							.setTitle(this.strings.openAsBoard)
							.setIcon("layout-grid")
							.onClick(() => void this.openAsBoard(leaf))
					);
				}
			})
		);

		this.registerEvent(this.app.workspace.on("file-open", () => this.switchBoardLeaves()));
		this.registerEvent(this.app.workspace.on("layout-change", () => this.switchBoardLeaves()));
		this.registerEvent(this.app.metadataCache.on("changed", () => this.switchBoardLeaves()));
		this.app.workspace.onLayoutReady(() => this.switchBoardLeaves());

		this.addSettingTab(new EisenhowerSettingTab(this.app, this));
	}

	async onExternalSettingsChange(): Promise<void> {
		await this.loadSettings();
		this.notifySettingsChange();
	}

	onSettingsChange(listener: () => void): () => void {
		this.settingsListeners.add(listener);
		return () => this.settingsListeners.delete(listener);
	}

	setShowCompleted(show: boolean): void {
		if (this.settings.showCompleted === show) return;
		this.settings.showCompleted = show;
		void this.saveSettings();
		this.notifySettingsChange();
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	isBoardFile(file: TFile): boolean {
		if (file.extension !== "md") return false;
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return !!frontmatter && frontmatter[FRONTMATTER_KEY] !== undefined;
	}

	async openAsMarkdown(leaf: WorkspaceLeaf): Promise<void> {
		const view = leaf.view;
		if (!(view instanceof BoardView) || !view.file) return;
		await view.save();
		this.markdownLeaves.set(leaf, view.file.path);
		await this.setLeafView(leaf, "markdown", view.file.path);
	}

	async openAsBoard(leaf: WorkspaceLeaf): Promise<void> {
		const view = leaf.view;
		if (!(view instanceof MarkdownView) || !view.file) return;
		await view.save();
		this.markdownLeaves.delete(leaf);
		await this.setLeafView(leaf, VIEW_TYPE_BOARD, view.file.path);
	}

	async createBoard(folder?: TFolder): Promise<void> {
		const target = folder ?? (await this.defaultFolder());
		const prefix = target.isRoot() ? "" : `${target.path}/`;
		const base = this.strings.newBoardName;
		let path = normalizePath(`${prefix}${base}.md`);
		for (let index = 1; this.app.vault.getAbstractFileByPath(path); index++) {
			path = normalizePath(`${prefix}${base} ${index}.md`);
		}
		const file = await this.app.vault.create(path, serializeBoard(emptyBoard(this.strings.titles), ""));
		const leaf = this.app.workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_BOARD, state: { file: file.path }, active: true });
	}

	private async defaultFolder(): Promise<TFolder> {
		const configured = this.settings.newBoardFolder.trim();
		if (configured) {
			const path = normalizePath(configured);
			const existing = this.app.vault.getAbstractFileByPath(path);
			if (existing instanceof TFolder) return existing;
			if (!existing) return await this.app.vault.createFolder(path);
		}
		return this.app.workspace.getActiveFile()?.parent ?? this.app.vault.getRoot();
	}

	private switchBoardLeaves(): void {
		this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !view.file) return;
			if (this.switchingLeaves.has(leaf) || this.markdownLeaves.get(leaf) === view.file.path) return;
			if (!this.isBoardFile(view.file)) return;
			this.switchingLeaves.add(leaf);
			void this.setLeafView(leaf, VIEW_TYPE_BOARD, view.file.path).finally(() => this.switchingLeaves.delete(leaf));
		});
	}

	private async setLeafView(leaf: WorkspaceLeaf, type: string, file: string): Promise<void> {
		const current = leaf.getViewState();
		const state: ViewState = {
			...current,
			type,
			state: { ...(current.state ?? {}), file },
			popstate: true,
		} as ViewState;
		await leaf.setViewState(state);
	}

	private async loadSettings(): Promise<void> {
		const saved = ((await this.loadData()) ?? {}) as Partial<PluginSettings>;
		this.settings = {
			showCompleted: typeof saved.showCompleted === "boolean" ? saved.showCompleted : DEFAULT_SETTINGS.showCompleted,
			newBoardFolder: typeof saved.newBoardFolder === "string" ? saved.newBoardFolder : DEFAULT_SETTINGS.newBoardFolder,
		};
	}

	private notifySettingsChange(): void {
		this.settingsListeners.forEach((listener) => listener());
	}
}
