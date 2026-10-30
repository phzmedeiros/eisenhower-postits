import { App, Modal, Setting } from "obsidian";

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private message: string,
		private confirmText: string,
		private cancelText: string,
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText(this.cancelText).onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					.setDestructive()
					.onClick(() => {
						this.onConfirm();
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class QuickAddModal extends Modal {
	constructor(
		app: App,
		private heading: string,
		private placeholder: string,
		private onSubmit: (text: string) => void
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.heading);
		const input = this.contentEl.createEl("input", {
			type: "text",
			cls: "ep-quick-input",
			attr: { placeholder: this.placeholder },
		});
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter" || event.isComposing) return;
			event.preventDefault();
			const text = input.value.trim();
			if (!text) return;
			this.onSubmit(text);
			this.close();
		});
		window.setTimeout(() => input.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
