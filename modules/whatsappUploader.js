const DEBUG = true;
const logDebug = (...args) => {
	if (!DEBUG) return;
	try { console.log('[HEROIA PDF]', ...args); } catch (_) { /* noop */ }
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const suppressFileDialog = (durationMs = 1800) => {
	const clickBlocker = event => {
		const target = event?.target;
		if (target && target.tagName === 'INPUT' && target.type === 'file') {
			event.preventDefault();
			event.stopImmediatePropagation();
			logDebug('Blocked native file dialog (click)');
			return false;
		}
	};
	document.addEventListener('click', clickBlocker, true);

	const originalShowPicker = HTMLInputElement.prototype.showPicker;
	HTMLInputElement.prototype.showPicker = function (...args) {
		if (this.type === 'file') {
			logDebug('Blocked native file dialog (showPicker)');
			return undefined;
		}
		return originalShowPicker ? originalShowPicker.apply(this, args) : undefined;
	};

	setTimeout(() => {
		document.removeEventListener('click', clickBlocker, true);
		HTMLInputElement.prototype.showPicker = originalShowPicker;
	}, durationMs);
};

const clickAttachButton = () => {
	const attachButton = document.querySelector('button[data-testid="attach-media"]')
		|| document.querySelector('button[data-testid="clip"]')
		|| document.querySelector('button[aria-label*="Anexar" i]')
		|| document.querySelector('span[data-icon="clip"]')?.closest('button');
	if (attachButton) {
		attachButton.click();
		logDebug('Clicked paperclip');
		return true;
	}
	logDebug('Attach button not found');
	return false;
};

const findDocumentMenuButton = () => {
	const byTestId = document.querySelector('button[data-testid="attach-document"]');
	if (byTestId) return byTestId;
	const byLabel = Array.from(document.querySelectorAll('button[aria-label], [title]'))
		.find(btn => ((btn.getAttribute('aria-label') || btn.getAttribute('title') || '')).toLowerCase().includes('document'));
	if (byLabel) return byLabel;
	const byText = Array.from(document.querySelectorAll('button, span, div'))
		.find(el => (el.textContent || '').trim().toLowerCase() === 'documento');
	return byText ? (byText.closest('button') || byText) : null;
};

const clickDocumentOption = () => {
	const docButton = findDocumentMenuButton();
	if (docButton) {
		docButton.click();
		logDebug('Clicked Documento');
		return true;
	}
	logDebug('Documento option not found');
	return false;
};

const waitForInput = async (predicate, timeout = 3000, interval = 140) => {
	const start = Date.now();
	let attempt = null;
	while (Date.now() - start < timeout) {
		attempt = predicate();
		if (attempt) return attempt;
		await wait(interval);
	}
	return attempt;
};

const isPdfFriendly = input => {
	const accept = (input.getAttribute('accept') || '').toLowerCase();
	if (accept.includes('image/') || accept.includes('video/') || accept.includes('audio/')) return false;
	if (accept.includes('application/pdf')) return true;
	if (accept.includes('.pdf')) return true;
	if (accept.includes('application')) return true;
	if (accept.includes('pdf')) return true;
	if (accept.includes('document')) return true;
	if (accept === '' || accept.includes('*/*') || accept.includes('*')) return true;
	return false;
};

const findDocumentInput = () => {
	const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
		.filter(i => !i.disabled && isPdfFriendly(i));
	const preferPdf = inputs.find(i => (i.getAttribute('accept') || '').toLowerCase().includes('application/pdf'));
	const visible = inputs.filter(el => el.isConnected && el.getClientRects().length > 0);
	const chosen = preferPdf || visible[visible.length - 1] || inputs[inputs.length - 1] || null;
	if (chosen) {
		logDebug('Found document input', { accept: chosen.getAttribute('accept'), id: chosen.id, name: chosen.name });
	}
	return chosen;
};

const dispatchDrop = file => {
	const target = document.querySelector('[data-testid="conversation-compose-box-input"]')
		|| document.querySelector('[data-testid="conversation-compose-box"]')
		|| document.querySelector('div[contenteditable="true"]');
	if (!target) return false;
	const dt = new DataTransfer();
	dt.items.add(file);
	['dragenter', 'dragover', 'drop'].forEach(type => {
		const evt = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
		target.dispatchEvent(evt);
	});
	return true;
};

const ensurePdfFile = async file => {
	if (!file) throw new Error('Nenhum arquivo fornecido para envio.');
	const original = file;
	const buffer = await original.arrayBuffer();
	const rawName = original.name || 'documento.pdf';
	const normalizedName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName.replace(/\.pdf$/i, '')}.pdf`;
	const realFile = new File(
		[buffer],
		normalizedName,
		{
			type: 'application/pdf',
			lastModified: original.lastModified || Date.now()
		}
	);

	logDebug('File prepared', { name: realFile.name, type: realFile.type, size: realFile.size });

	if (realFile.type !== 'application/pdf') {
		throw new Error('O arquivo não pôde ser convertido para PDF.');
	}
	if (!realFile.size) {
		throw new Error('O arquivo PDF está vazio.');
	}
	if (!realFile.name.toLowerCase().endsWith('.pdf')) {
		throw new Error('O arquivo precisa ter extensão .pdf.');
	}

	return realFile;
};

const openDocumentInput = async () => {
	clickAttachButton();
	await wait(200);
	let input = findDocumentInput();
	if (input) return input;

	// Need to click Documento to spawn the document input; suppress dialog during this action.
	suppressFileDialog();
	clickDocumentOption();
	input = await waitForInput(findDocumentInput, 3200, 140);
	return input;
};

export const injectFileIntoWhatsApp = async file => {
	try {
		const realFile = await ensurePdfFile(file);
		let input = await openDocumentInput();
		if (!input) input = findDocumentInput();

		logDebug('Selected input', input ? { accept: input.getAttribute('accept'), id: input.id, name: input.name } : 'none');

		if (!input) {
			const dropped = dispatchDrop(realFile);
			logDebug('Fallback drop used', { success: dropped });
			if (!dropped) throw new Error('Campo de upload do WhatsApp não encontrado. Abra a conversa e tente novamente.');
			return;
		}

		const dt = new DataTransfer();
		dt.items.add(realFile);
		input.files = dt.files;

		logDebug('Dispatching events', { fileName: realFile.name, fileType: realFile.type, fileSize: realFile.size });

		input.dispatchEvent(new Event('change', { bubbles: true }));
		input.dispatchEvent(new Event('input', { bubbles: true }));

	} catch (err) {
		logDebug('Upload error', err?.message || err);
		throw err;
	}
};
