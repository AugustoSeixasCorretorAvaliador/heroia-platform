import { insertTextDraft } from '../services/textInsert.js';
import { getFileByName, listFilesByType } from './pdfManager.js';
import { injectFileIntoWhatsApp } from './whatsappUploader.js';
import { getUsableDirectoryHandle, ensurePermission, reconnectFlow } from './fileSystem.js';

const overlayIds = {
	overlay: 'hero-ssd-overlay',
	panel: 'hero-ssd-panel',
	close: 'hero-ssd-close',
	picker: 'hero-ssd-picker',
	pickerInner: 'hero-ssd-picker-inner',
	item: 'hero-ssd-item',
	tipo: 'hero-ssd-tipo',
	message: 'hero-ssd-message',
	send: 'hero-ssd-send',
	reconnect: 'hero-ssd-reconnect'
};

const pdfTypes = [
	{ value: 'BOOK', label: 'Book' },
	{ value: 'TABELA', label: 'Tabela de Preço' },
	{ value: 'DISPO', label: 'Disponibilidade' },
	{ value: 'REPASSE', label: 'Repasse' }
];

const state = {
	directoryHandle: null,
	selectedType: pdfTypes[0].value,
	selectedName: null
};

const showNotification = (message, type = 'success') => {
	const notification = document.createElement('div');
	notification.style.cssText = `
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2147483646;
		padding: 16px 24px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		animation: hero-ssd-slideDown 0.3s ease-out;
		max-width: 400px;
		text-align: center;
		${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;'}
	`;
	notification.textContent = message;

	const style = document.createElement('style');
	style.textContent = `@keyframes hero-ssd-slideDown { from { top: -100px; opacity: 0; } to { top: 20px; opacity: 1; } }`;
	document.head.appendChild(style);

	document.body.appendChild(notification);
	setTimeout(() => {
		notification.style.transition = 'opacity 0.3s ease-out';
		notification.style.opacity = '0';
		setTimeout(() => notification.remove(), 300);
	}, 4000);
};

const ensureSupport = () => {
	if (!('showDirectoryPicker' in window)) {
		throw new Error('File System Access API não é suportada. Use o Chrome Desktop.');
	}
	if (typeof DataTransfer === 'undefined') {
		throw new Error('Seu navegador não permite anexar arquivos localmente.');
	}
};

const setMessage = (text, tone = 'info') => {
	const messageDiv = document.getElementById(overlayIds.message);
	if (!messageDiv) return;
	const palette = {
		info: { bg: '#e3f2fd', color: '#0d47a1' },
		success: { bg: '#d4edda', color: '#155724' },
		warning: { bg: '#fff3cd', color: '#856404' },
		error: { bg: '#f8d7da', color: '#721c24' }
	}[tone] || { bg: '#e3f2fd', color: '#0d47a1' };
	messageDiv.style.display = 'block';
	messageDiv.style.background = palette.bg;
	messageDiv.style.color = palette.color;
	messageDiv.textContent = text;
};

const clearMessage = () => {
	const messageDiv = document.getElementById(overlayIds.message);
	if (!messageDiv) return;
	messageDiv.style.display = 'none';
	messageDiv.textContent = '';
};

const renderItems = items => {
	const picker = document.getElementById(overlayIds.pickerInner);
	if (!picker) return;
	picker.innerHTML = '';

	const topSpacer = document.createElement('div');
	topSpacer.className = 'hero-ssd-spacer';
	picker.appendChild(topSpacer);

	items.forEach(item => {
		const div = document.createElement('div');
		div.className = 'hero-ssd-item';
		div.dataset.name = item.name;
		div.dataset.label = item.displayName;
		div.textContent = item.displayName;
		picker.appendChild(div);
	});

	const bottomSpacer = document.createElement('div');
	bottomSpacer.className = 'hero-ssd-spacer';
	picker.appendChild(bottomSpacer);

	const itemsEls = Array.from(picker.querySelectorAll('.hero-ssd-item'));
	let selectedEl = null;

	const updateActiveItem = () => {
		const pickerRect = picker.getBoundingClientRect();
		const centerY = pickerRect.top + pickerRect.height / 2;
		let closestItem = null;
		let closestDistance = Infinity;
		itemsEls.forEach(item => {
			const rect = item.getBoundingClientRect();
			const itemCenterY = rect.top + rect.height / 2;
			const distance = Math.abs(centerY - itemCenterY);
			const maxDistance = 120;
			const opacity = Math.max(0.3, 1 - (distance / maxDistance));
			const scale = Math.max(0.9, 1.1 - (distance / maxDistance) * 0.4);
			item.style.opacity = opacity;
			item.style.transform = `scale(${scale})`;
			if (distance < closestDistance) {
				closestDistance = distance;
				closestItem = item;
			}
		});
		itemsEls.forEach(item => item.classList.remove('hero-ssd-active'));
		if (closestItem) {
			closestItem.classList.add('hero-ssd-active');
			selectedEl = closestItem;
			state.selectedName = closestItem.dataset.name;
		}
	};

	picker.onscroll = updateActiveItem;
	itemsEls.forEach(item => {
		item.onclick = () => item.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});
	setTimeout(() => {
		if (itemsEls[0]) {
			itemsEls[0].scrollIntoView({ block: 'center' });
			updateActiveItem();
		}
	}, 100);

};

const refreshList = async () => {
	const picker = document.getElementById(overlayIds.pickerInner);
	if (!picker) return;

	clearMessage();
	picker.innerHTML = '<div class="hero-ssd-item" style="padding:20px; text-align:center;">Carregando...</div>';

	try {
		const files = await listFilesByType(state.directoryHandle, state.selectedType);
		if (!files.length) {
			setMessage('Nenhum PDF encontrado para este tipo. Verifique a pasta HEROIA/pdf.', 'warning');
			picker.innerHTML = '';
			return;
		}
		renderItems(files);
	} catch (err) {
		setMessage(err.message, 'error');
		picker.innerHTML = '';
	}
};

const rebuildOverlay = () => {
	const existing = document.getElementById(overlayIds.overlay);
	if (existing) existing.remove();

	const overlay = document.createElement('div');
	overlay.id = overlayIds.overlay;
	overlay.innerHTML = `
		<div class="hero-ssd-panel" id="${overlayIds.panel}">
			<header>
				<strong>Enviar PDF (Local)</strong>
				<div style="display:flex; gap:8px; align-items:center;">
					<button id="${overlayIds.reconnect}" title="Reconectar pasta" style="background: #1565c0; border: 1px solid #0d47a1; color: #fff; border-radius: 6px; padding: 6px 10px; cursor: pointer;">Reconectar</button>
					<button id="${overlayIds.close}">×</button>
				</div>
			</header>
			<section>
				<label>Tipo de Documento</label>
				<select id="${overlayIds.tipo}">
					${pdfTypes.map(type => `<option value="${type.value}">${type.label}</option>`).join('')}
				</select>
				<label>Selecione o arquivo</label>
				<div class="hero-ssd-picker" id="${overlayIds.picker}">
					<div class="hero-ssd-picker-inner" id="${overlayIds.pickerInner}"></div>
					<div class="hero-ssd-picker-fade-bottom"></div>
				</div>
			</section>
			<footer>
				<div id="${overlayIds.message}" style="display:none; padding:8px; margin-bottom:8px; border-radius:4px; font-size:13px; text-align:center;"></div>
				<button id="${overlayIds.send}">ENVIAR PDF</button>
			</footer>
		</div>
	`;

	document.body.appendChild(overlay);

	const select = overlay.querySelector(`#${overlayIds.tipo}`);
	select.value = state.selectedType;
	select.onchange = async () => {
		state.selectedType = select.value;
		state.selectedName = null;
		await refreshList();
	};

	const reconnectBtn = overlay.querySelector(`#${overlayIds.reconnect}`);
	reconnectBtn.onclick = async () => {
		setMessage('Solicitando nova pasta...', 'info');
		const handle = await reconnectFlow();
		if (!handle) {
			setMessage('Pasta não conectada. Autorize o acesso para continuar.', 'error');
			return;
		}
		state.directoryHandle = handle;
		clearMessage();
		await refreshList();
	};

	const closeBtn = overlay.querySelector(`#${overlayIds.close}`);
	closeBtn.onclick = () => overlay.remove();
	overlay.onclick = event => { if (event.target === overlay) overlay.remove(); };

	const sendBtn = overlay.querySelector(`#${overlayIds.send}`);
	sendBtn.onclick = async () => {
		if (!state.selectedName) {
			setMessage('⚠️ Selecione um PDF para enviar.', 'warning');
			return;
		}
		sendBtn.disabled = true;
		sendBtn.textContent = 'Anexando...';
		try {
			const file = await getFileByName(state.directoryHandle, state.selectedName);
			await injectFileIntoWhatsApp(file);
			const label = document.querySelector(`.${overlayIds.item}.hero-ssd-active`)?.dataset?.label || state.selectedName;
			insertTextDraft(`Segue o PDF ${label}.`);
			showNotification('✅ PDF anexado no WhatsApp. Confirme o envio.', 'success');
			overlay.remove();
		} catch (err) {
			setMessage(err.message, 'error');
		} finally {
			sendBtn.disabled = false;
			sendBtn.textContent = 'ENVIAR PDF';
		}
	};

	return overlay;
};

export const runPdf = async () => {
	try {
		ensureSupport();
		const handle = await getUsableDirectoryHandle();
		if (!handle) {
			alert('Selecione a pasta HEROIA/pdf para enviar PDFs localmente.');
			return;
		}
		state.directoryHandle = handle;
		await ensurePermission(handle);
		rebuildOverlay();
		await refreshList();
	} catch (err) {
		alert(`Erro ao carregar PDFs locais: ${err.message}`);
	}
};
