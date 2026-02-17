import { insertTextDraft } from '../services/textInsert.js';

const SSD_BASE_URL = 'https://pdf.hero.ia.br';
const SSD_INDEX_URL = `${SSD_BASE_URL}/index.json`;
const overlayIds = {
	overlay: 'hero-ssd-overlay',
	panel: 'hero-ssd-panel',
	close: 'hero-ssd-close',
	picker: 'hero-ssd-picker',
	pickerInner: 'hero-ssd-picker-inner',
	item: 'hero-ssd-item',
	tipo: 'hero-ssd-tipo',
	message: 'hero-ssd-message',
	send: 'hero-ssd-send'
};

let ssdIndex = null;
let ssdBase = SSD_BASE_URL;
let listenerAttached = false;

const ensureFetchListener = () => {
	if (listenerAttached) return;
	listenerAttached = true;

	window.addEventListener('message', async (event) => {
		if (event.source !== window || event.data.type !== 'SSD_FETCH_PDF') return;
		const { url, requestId } = event.data;
		try {
			const pdfResponse = await fetch(url);
			if (!pdfResponse.ok) throw new Error(`HTTP ${pdfResponse.status}`);
			const blob = await pdfResponse.blob();
			const reader = new FileReader();
			reader.onload = () => {
				window.postMessage({ type: 'SSD_PDF_RESPONSE', requestId, success: true, data: reader.result }, '*');
			};
			reader.readAsDataURL(blob);
		} catch (err) {
			window.postMessage({ type: 'SSD_PDF_RESPONSE', requestId, success: false, error: err.message }, '*');
		}
	});
};

const loadIndex = async () => {
	if (ssdIndex) return ssdIndex;
	const response = await fetch(SSD_INDEX_URL, { cache: 'no-store' });
	if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	ssdIndex = await response.json();
	return ssdIndex;
};

const fetchPdfViaContent = (url) => new Promise((resolve, reject) => {
	const requestId = `pdf_${Date.now()}_${Math.random()}`;
	const listener = (event) => {
		if (event.source !== window || event.data.type !== 'SSD_PDF_RESPONSE') return;
		if (event.data.requestId !== requestId) return;
		window.removeEventListener('message', listener);
		if (event.data.success) resolve(event.data.data);
		else reject(new Error(event.data.error));
	};

	window.addEventListener('message', listener);
	setTimeout(() => {
		window.removeEventListener('message', listener);
		reject(new Error('Timeout ao baixar PDF'));
	}, 10000);

	window.postMessage({ type: 'SSD_FETCH_PDF', url, requestId }, '*');
});

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

const ensureOverlay = (index) => {
	if (document.getElementById(overlayIds.overlay)) return document.getElementById(overlayIds.overlay);

	const produtos = Object.entries(index)
		.map(([id, p]) => ({ id, nome: p.nome }))
		.sort((a, b) => a.nome.localeCompare(b.nome));

	const overlay = document.createElement('div');
	overlay.id = overlayIds.overlay;
	overlay.innerHTML = `
		<div class="hero-ssd-panel" id="${overlayIds.panel}">
			<header>
				<strong>Enviar PDF (SSD)</strong>
				<button id="${overlayIds.close}">×</button>
			</header>
			<section>
				<label>Tipo de Documento</label>
				<select id="${overlayIds.tipo}">
					<option value="book">Book</option>
					<option value="preco">Tabela de Preço</option>
					<option value="disponibilidade">Disponibilidade</option>
					<option value="repasse">Repasse</option>
				</select>
				<label>Selecione o Produto</label>
				<div class="hero-ssd-picker" id="${overlayIds.picker}">
					<div class="hero-ssd-picker-inner" id="${overlayIds.pickerInner}">
						<div class="hero-ssd-spacer"></div>
						${produtos.map(p => `
							<div class="hero-ssd-item" data-id="${p.id}">
								${p.nome}
							</div>`).join('')}
						<div class="hero-ssd-spacer"></div>
					</div>
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

	const picker = overlay.querySelector(`#${overlayIds.pickerInner}`);
	const items = Array.from(overlay.querySelectorAll('.hero-ssd-item'));
	let selectedId = null;

	const updateActiveItem = () => {
		const pickerRect = picker.getBoundingClientRect();
		const centerY = pickerRect.top + pickerRect.height / 2;
		let closestItem = null;
		let closestDistance = Infinity;
		items.forEach(item => {
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
		items.forEach(item => item.classList.remove('hero-ssd-active'));
		if (closestItem) {
			closestItem.classList.add('hero-ssd-active');
			selectedId = closestItem.dataset.id;
		}
	};

	picker.addEventListener('scroll', updateActiveItem);
	items.forEach(item => { item.onclick = () => item.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
	setTimeout(() => { if (items[0]) { items[0].scrollIntoView({ block: 'center' }); updateActiveItem(); } }, 100);

	overlay.querySelector(`#${overlayIds.close}`).onclick = () => overlay.remove();
	overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

	const messageDiv = overlay.querySelector(`#${overlayIds.message}`);
	overlay.querySelector(`#${overlayIds.send}`).onclick = async () => {
		if (!selectedId) {
			messageDiv.style.display = 'block';
			messageDiv.style.background = '#fff3cd';
			messageDiv.style.color = '#856404';
			messageDiv.textContent = '⚠️ Selecione um produto';
			setTimeout(() => messageDiv.style.display = 'none', 3000);
			return;
		}
		const tipo = overlay.querySelector(`#${overlayIds.tipo}`).value;
		const result = await sendPdf(selectedId, tipo, messageDiv);
		if (result) overlay.remove();
	};

	return overlay;
};

const sendPdf = async (produtoId, tipo, messageDiv) => {
	if (!ssdIndex) return false;
	const produto = ssdIndex[produtoId];
	if (!produto) {
		alert(`Produto não encontrado: ${produtoId}`);
		return false;
	}

	if (!produto.docs || produto.docs[tipo] === null || produto.docs[tipo] === 'null') {
		const tipoLabel = { book: 'Book', preco: 'Tabela de Preço', disponibilidade: 'Tabela de Disponibilidade', repasse: 'Tabela de Repasses' }[tipo] || tipo;
		messageDiv.style.display = 'block';
		messageDiv.style.background = '#f8d7da';
		messageDiv.style.color = '#721c24';
		messageDiv.textContent = `❌ ${tipoLabel} não disponível`;
		setTimeout(() => messageDiv.style.display = 'none', 3000);
		return false;
	}

	const pdfFileName = produto.docs[tipo];
	const url = `${ssdBase}/pdf/${tipo}/${pdfFileName}`;

	try {
		const pdfData = await fetchPdfViaContent(url);
		const response = await fetch(pdfData);
		const blob = await response.blob();
		const fileUrl = URL.createObjectURL(blob);

		const tipoInfo = {
			book: { artigo: 'o', label: 'Book' },
			preco: { artigo: 'a', label: 'Tabela de Preço' },
			disponibilidade: { artigo: 'a', label: 'Tabela de Disponibilidade' },
			repasse: { artigo: 'a', label: 'Tabela de Repasses' }
		}[tipo] || { artigo: 'o', label: tipo };

		const text = `Segue (${tipoInfo.artigo}) ${tipoInfo.label} do empreendimento ${produto.nome}, conforme solicitado.\n\n🔗 ${ssdBase}/pdf/${tipo}/${produtoId}.pdf`;
		insertTextDraft(text);

		const a = document.createElement('a');
		a.href = fileUrl;
		a.download = `${produto.nome} - ${tipo}.pdf`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(fileUrl);

		showNotification('✅ Texto inserido! 📎 PDF baixado. Arraste o arquivo para anexar.', 'success');
		return true;
	} catch (err) {
		alert(`Erro ao carregar o PDF:\n${err.message}\n\nURL tentada: ${url}`);
		return false;
	}
};

export const runPdf = async () => {
	try {
		ensureFetchListener();
		await loadIndex();
		ensureOverlay(ssdIndex);
	} catch (err) {
		alert('Erro ao carregar lista de produtos. Verifique sua conexão.');
	}
};
