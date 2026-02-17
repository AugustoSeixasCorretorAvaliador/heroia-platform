import { getInputBox } from './waDom.js';

// Insert text as a draft without sending.
export const insertTextDraft = text => {
	const input = getInputBox();
	if (!input) {
		console.warn('HERO IA: input box not found');
		return false;
	}

	input.focus();

	const selection = window.getSelection();
	const range = document.createRange();

	input.innerHTML = '';
	const textNode = document.createTextNode(text);
	input.appendChild(textNode);

	range.setStart(textNode, textNode.length);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);

	input.dispatchEvent(new InputEvent('input', {
		bubbles: true,
		cancelable: true,
		data: text,
		inputType: 'insertText'
	}));

	return true;
};
