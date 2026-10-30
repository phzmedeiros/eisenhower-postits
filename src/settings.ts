import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type EisenhowerPostitsPlugin from "./main";

export class EisenhowerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: EisenhowerPostitsPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const strings = this.plugin.strings;
		return [
			{
				name: strings.folderSetting,
				desc: strings.folderSettingDesc,
				aliases: ["folder", "pasta", "location"],
				control: { type: "folder", key: "newBoardFolder", includeRoot: true },
			},
			{
				name: strings.showCompleted,
				desc: strings.showCompletedDesc,
				aliases: ["completed", "done", "concluídos"],
				control: { type: "toggle", key: "showCompleted" },
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "newBoardFolder") return this.plugin.settings.newBoardFolder;
		if (key === "showCompleted") return this.plugin.settings.showCompleted;
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === "showCompleted") {
			this.plugin.setShowCompleted(value === true);
			return;
		}
		if (key === "newBoardFolder") {
			this.plugin.settings.newBoardFolder = typeof value === "string" ? value.trim() : "";
			await this.plugin.saveSettings();
		}
	}
}
