// WhatsApp DOM helpers (no UI creation here).

const CORE_BUTTON_TEXT = /(gerar\s+rascunho|copiloto|follow-up|follow up)/i;

export const getConversationText = () => {
	const panel = document.querySelector('[data-testid="conversation-panel-body"]') || document.querySelector('#main');
	if (!panel) return '';

	const messages = Array.from(panel.querySelectorAll('[data-pre-plain-text], [data-testid="msg-container"], [data-id]'))
		.map(node => (node.innerText || '').trim())
		.filter(Boolean);

	return messages.join('\n').trim();
};

export const getInputBox = () => {
	const selectors = [
		'footer [contenteditable="true"][data-tab="10"]',
		'footer [contenteditable="true"][data-tab="6"]',
		'footer [contenteditable="true"]',
		'#main [contenteditable="true"][data-lexical-editor="true"]'
	];

	for (const sel of selectors) {
		const el = document.querySelector(sel);
		if (el) return el;
	}
	return null;
};

export const findCoreButtonContainer = () => {
	const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(el => CORE_BUTTON_TEXT.test((el.textContent || '').toLowerCase()));
	if (!btn) return null;
	const container = btn.closest('div');
	return container || btn.parentElement;
};

export const findAnchorForToolbar = () => {
	const container = findCoreButtonContainer();
	if (container) return container;

	const input = getInputBox();
	if (input) return input.closest('footer') || input.parentElement;

	return document.querySelector('#main');
};
