import { QuadrantId } from "./types";

export interface Strings {
	newBoard: string;
	newBoardName: string;
	newBoardInFolder: string;
	openAsMarkdown: string;
	openAsBoard: string;
	toggleView: string;
	addToCommand: string;
	boardTitle: string;
	invalidName: string;
	nameTaken: string;
	titles: Record<QuadrantId, string>;
	subtitles: Record<QuadrantId, string>;
	renameQuadrant: string;
	addNote: string;
	emptyHint: string;
	placeholder: string;
	markDone: string;
	markUndone: string;
	edit: string;
	moveTo: string;
	delete: string;
	more: string;
	showCompleted: string;
	showCompletedDesc: string;
	clearCompleted: string;
	clearConfirm: (count: number) => string;
	nothingToClear: string;
	cancel: string;
	folderSetting: string;
	folderSettingDesc: string;
	quickAddPlaceholder: string;
	add: string;
	urgentQuestion: string;
	importantQuestion: string;
	yes: string;
	no: string;
	goesTo: string;
	missingText: string;
	missingChoice: string;
	filterByTag: string;
	addCommand: string;
}

const en: Strings = {
	newBoard: "Create new matrix",
	newBoardName: "Eisenhower matrix",
	newBoardInFolder: "New Eisenhower matrix",
	openAsMarkdown: "Open as markdown",
	openAsBoard: "Open as Eisenhower matrix",
	toggleView: "Toggle between matrix and markdown",
	addToCommand: "Add sticky note to",
	boardTitle: "Matrix title",
	invalidName: "A title cannot contain any of these characters: \\ / : * ? \" < > | # ^ [ ]",
	nameTaken: "There is already a file with this title in the folder.",
	titles: {
		do: "Do now",
		schedule: "Schedule",
		delegate: "Delegate",
		eliminate: "Eliminate",
	},
	subtitles: {
		do: "Urgent and important",
		schedule: "Important, not urgent",
		delegate: "Urgent, not important",
		eliminate: "Neither urgent nor important",
	},
	renameQuadrant: "Double-click to rename",
	addNote: "Add sticky note",
	emptyHint: "Double-click or drag here to add +",
	placeholder: "Write and press Enter",
	markDone: "Mark as done",
	markUndone: "Mark as not done",
	edit: "Edit",
	moveTo: "Move to",
	delete: "Delete",
	more: "More options",
	showCompleted: "Show completed",
	showCompletedDesc: "Keep completed sticky notes visible at the end of each quadrant.",
	clearCompleted: "Clear completed",
	clearConfirm: (count) => `Delete ${count} completed sticky ${count === 1 ? "note" : "notes"}?`,
	nothingToClear: "There are no completed sticky notes.",
	cancel: "Cancel",
	folderSetting: "Folder for new matrices",
	folderSettingDesc: "Leave empty to create them in the folder of the active note.",
	quickAddPlaceholder: "What needs to be done?",
	add: "Add",
	urgentQuestion: "Urgent?",
	importantQuestion: "Important?",
	yes: "Yes",
	no: "No",
	goesTo: "Goes to",
	missingText: "Write what needs to be done.",
	missingChoice: "Choose whether it is urgent and whether it is important.",
	filterByTag: "Filter by tag",
	addCommand: "Add sticky note",
};

const pt: Strings = {
	newBoard: "Criar matriz",
	newBoardName: "Matriz de Eisenhower",
	newBoardInFolder: "Nova matriz de Eisenhower",
	openAsMarkdown: "Abrir como markdown",
	openAsBoard: "Abrir como matriz de Eisenhower",
	toggleView: "Alternar entre matriz e markdown",
	addToCommand: "Adicionar post-it em",
	boardTitle: "Título da matriz",
	invalidName: "O título não pode ter estes caracteres: \\ / : * ? \" < > | # ^ [ ]",
	nameTaken: "Já existe um arquivo com esse título na pasta.",
	titles: {
		do: "Faça agora",
		schedule: "Agende",
		delegate: "Delegue",
		eliminate: "Elimine",
	},
	subtitles: {
		do: "Urgente e importante",
		schedule: "Importante, não urgente",
		delegate: "Urgente, não importante",
		eliminate: "Nem urgente nem importante",
	},
	renameQuadrant: "Clique duas vezes para renomear",
	addNote: "Adicionar post-it",
	emptyHint: "Duplo-clique ou arraste para adicionar +",
	placeholder: "Escreva e aperte Enter",
	markDone: "Marcar como feito",
	markUndone: "Desmarcar",
	edit: "Editar",
	moveTo: "Mover para",
	delete: "Excluir",
	more: "Mais opções",
	showCompleted: "Mostrar concluídos",
	showCompletedDesc: "Mantém os post-its concluídos visíveis no fim de cada quadrante.",
	clearCompleted: "Limpar concluídos",
	clearConfirm: (count) => `Excluir ${count} ${count === 1 ? "post-it concluído" : "post-its concluídos"}?`,
	nothingToClear: "Não há post-its concluídos.",
	cancel: "Cancelar",
	folderSetting: "Pasta das novas matrizes",
	folderSettingDesc: "Deixe vazio para criar na pasta da nota aberta.",
	quickAddPlaceholder: "O que precisa ser feito?",
	add: "Adicionar",
	urgentQuestion: "Urgente?",
	importantQuestion: "Importante?",
	yes: "Sim",
	no: "Não",
	goesTo: "Vai para",
	missingText: "Escreva o que precisa ser feito.",
	missingChoice: "Escolha se é urgente e se é importante.",
	filterByTag: "Filtrar por tag",
	addCommand: "Adicionar post-it",
};

export function getStrings(): Strings {
	const language = window.localStorage.getItem("language") ?? "en";
	return language.toLowerCase().startsWith("pt") ? pt : en;
}
