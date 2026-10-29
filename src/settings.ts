import { App, PluginSettingTab, Setting } from "obsidian";
import type EisenhowerPostitsPlugin from "./main";

export class EisenhowerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: EisenhowerPostitsPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		const strings = this.plugin.strings;
		containerEl.empty();

		new Setting(containerEl)
			.setName(strings.folderSetting)
			.setDesc(strings.folderSettingDesc)
			.addText((text) =>
				text.setValue(this.plugin.settings.newBoardFolder).onChange(async (value) => {
					this.plugin.settings.newBoardFolder = value.trim();
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(strings.showCompleted)
			.setDesc(strings.showCompletedDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCompleted)
					.onChange((value) => this.plugin.setShowCompleted(value))
			);
	}
}
