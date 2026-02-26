import { findAnchorForToolbar } from './waDom.js';
import { attachDisparoStatus } from './disparoStatus.js';

const STORAGE_ACTIVATION = 'heroia_activation_v2';
const INFO_WRAPPER_ID = 'heroia-info-wrapper';
const INFO_BTN_ID = 'heroia-info-btn';
const INFO_POPUP_ID = 'heroia-info-popup';
const INFO_CLOSE_ID = 'heroia-info-close';

let handlers = {
	onCoreDraft: null,
	onCoreFollowUp: null,
	onCoreRefine: null,
	onPdf: null,
	onAudio: null,
	onCredito: null,
	onDisparo: null
};

let toolbarEl = null;
let infoListenersBound = false;
const loadingTracked = new Set(['onCoreDraft', 'onCoreFollowUp', 'onCoreRefine' , 'onAudio']);

const buttonConfig = [
	{ id: 'hero-btn-core-draft', label: '✍️ Gerar rascunho', className: 'hero-btn', handlerKey: 'onCoreDraft' },
	{ id: 'hero-btn-core-follow', label: '🧠 Copiloto 🔁', className: 'hero-btn hero-btn-quaternary', handlerKey: 'onCoreFollowUp' },
	{ id: 'hero-btn-refine', label: '📝 Refinar TXT', className: 'hero-btn hero-btn-primary', handlerKey: 'onCoreRefine' },
	{ id: 'hero-btn-pdf', label: '📄 PDF', className: 'hero-btn hero-btn-tertiary', handlerKey: 'onPdf' },
	{ id: 'hero-btn-audio', label: '🎧 Audio', className: 'hero-btn hero-btn-muted', handlerKey: 'onAudio' },
	{ id: 'hero-btn-credito', label: '💰 Crédito', className: 'hero-btn hero-btn-secondary', handlerKey: 'onCredito' },
	{ id: 'hero-btn-disparo', label: '🚀 Disparo', className: 'hero-btn hero-btn-warning', handlerKey: 'onDisparo' }
];

const maskLicense = license => {
	if (!license || typeof license !== 'string') return '—';
	if (license.length <= 8) return license;
	return `${license.slice(0, 4)}•••${license.slice(-4)}`;
};

const formatDate = value => {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const toggleInfoPopup = show => {
	const popup = document.getElementById(INFO_POPUP_ID);
	if (!popup) return;
	popup.classList.toggle('heroia-hidden', !show);
};

const populateInfoPopup = info => {
	const statusEl = document.getElementById('info-status');
	const emailEl = document.getElementById('info-email');
	const licenseEl = document.getElementById('info-license');
	const deviceEl = document.getElementById('info-device');
	const activatedEl = document.getElementById('info-activated');
	const lastEl = document.getElementById('info-last');
	const versionEl = document.getElementById('info-version');

	if (statusEl) statusEl.textContent = info.status || '—';
	if (emailEl) emailEl.textContent = info.email || '—';
	if (licenseEl) licenseEl.textContent = maskLicense(info.license);
	if (deviceEl) deviceEl.textContent = info.device || '—';
	if (activatedEl) activatedEl.textContent = formatDate(info.activatedAt);
	if (lastEl) lastEl.textContent = formatDate(info.lastSeenAt);
	if (versionEl) versionEl.textContent = info.version || '—';
};

const fetchInfoAndShow = () => {
	const storage = typeof chrome !== 'undefined' ? chrome.storage?.local : null;
	const showBlank = () => {
		populateInfoPopup({});
		toggleInfoPopup(true);
	};

	if (!storage) {
		showBlank();
		return;
	}

	const keys = ['heroia_license', STORAGE_ACTIVATION, 'heroia_activation', 'heroia_license_cache'];
	try {
		storage.get(keys, data => {
			const info = data?.heroia_license
				|| data?.[STORAGE_ACTIVATION]
				|| data?.heroia_activation
				|| data?.heroia_license_cache
				|| {};
			const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
				? chrome.runtime.getManifest().version
				: undefined;
			populateInfoPopup({
				status: info.status,
				email: info.email,
				license: info.license_key || info.licenseKey,
				device: info.device_id || info.deviceId,
				activatedAt: info.activated_at || info.activatedAt,
				lastSeenAt: info.last_seen_at || info.lastSeenAt,
				version
			});
			toggleInfoPopup(true);
		});
	} catch (err) {
		console.error('HERO.IA info popup error', err);
		showBlank();
	}
};

const attachInfoListeners = () => {
	if (infoListenersBound) return;
	document.addEventListener('click', event => {
		const target = event.target;
		if (!target) return;

		if (target.closest(`#${INFO_BTN_ID}`)) {
			event.stopPropagation();
			fetchInfoAndShow();
			return;
		}

		if (target.closest(`#${INFO_CLOSE_ID}`)) {
			toggleInfoPopup(false);
			return;
		}

		if (!target.closest(`#${INFO_POPUP_ID}`) && !target.closest(`#${INFO_WRAPPER_ID}`)) {
			toggleInfoPopup(false);
		}
	});
	infoListenersBound = true;
};

const ensureInfoButton = container => {
	let wrapper = container.querySelector(`#${INFO_WRAPPER_ID}`);
	if (!wrapper) {
		const infoImgSrc = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
			? chrome.runtime.getURL('botao.jpg')
			: 'botao.jpg';
		wrapper = document.createElement('div');
		wrapper.id = INFO_WRAPPER_ID;
		wrapper.innerHTML = `
			<button id="${INFO_BTN_ID}" title="Status da Licença HERO.IA">
				<img src="${infoImgSrc}" alt="HERO.IA Info">
			</button>
			<div id="${INFO_POPUP_ID}" class="heroia-hidden">
				<button id="${INFO_CLOSE_ID}" aria-label="Fechar" title="Fechar">✕</button>
				<div class="hero-info-header">HERO.IA — Informações</div>
				<div class="hero-info-line"><strong>Status:</strong> <span id="info-status">—</span></div>
				<div class="hero-info-line"><strong>Email:</strong> <span id="info-email">—</span></div>
				<div class="hero-info-line"><strong>Licença:</strong> <span id="info-license">—</span></div>
				<div class="hero-info-line"><strong>Device ID:</strong> <span id="info-device">—</span></div>
				<div class="hero-info-line"><strong>Origem:</strong> Extensão Chrome</div>
				<div class="hero-info-line"><strong>Ativado em:</strong> <span id="info-activated">—</span></div>
				<div class="hero-info-line"><strong>Último acesso:</strong> <span id="info-last">—</span></div>
				<div class="hero-info-line"><strong>Versão:</strong> <span id="info-version">—</span></div>
			</div>
		`;
		container.prepend(wrapper);

		const btn = wrapper.querySelector(`#${INFO_BTN_ID}`);
		if (btn) {
			btn.addEventListener('click', evt => {
				evt.stopPropagation();
				fetchInfoAndShow();
			});
		}

		const closeBtn = wrapper.querySelector(`#${INFO_CLOSE_ID}`);
		if (closeBtn) {
			closeBtn.addEventListener('click', evt => {
				evt.stopPropagation();
				toggleInfoPopup(false);
			});
		}
	}

	attachInfoListeners();
};

const toggleButtonLoading = (btn, isLoading) => {
	if (!btn) return;
	btn.classList.toggle('hero-btn-loading', isLoading);
	btn.setAttribute('aria-busy', isLoading ? 'true' : 'false');
};

const attachHandlerToButton = (btn, handlerKey) => {
	if (!btn) return;
	btn.onclick = async () => {
		const fn = handlers[handlerKey];
		if (typeof fn !== 'function') return;
		const trackLoading = loadingTracked.has(handlerKey);
		if (trackLoading) toggleButtonLoading(btn, true);
		try {
			await fn();
		} catch (err) {
			console.error('HERO.IA toolbar handler error', err);
		} finally {
			if (trackLoading) toggleButtonLoading(btn, false);
		}
	};
};

const createButton = ({ id, label, className, handlerKey }) => {
	const btn = document.createElement('button');
	btn.id = id;
	btn.type = 'button';
	btn.className = className;
	btn.textContent = label;
	attachHandlerToButton(btn, handlerKey);
	return btn;
};

const ensureButtons = container => {
	buttonConfig.forEach(cfg => {
		let btn = container.querySelector(`#${cfg.id}`);
		if (!btn) {
			btn = createButton(cfg);
			container.appendChild(btn);
		} else {
			attachHandlerToButton(btn, cfg.handlerKey);
		}

		if (cfg.id === 'hero-btn-disparo') {
			attachDisparoStatus(btn);
		}
	});
};

export const setHandlers = nextHandlers => {
	handlers = { ...handlers, ...nextHandlers };
	ensureToolbar();
};

export const ensureToolbar = () => {
	const anchor = findAnchorForToolbar();
	if (!anchor) return;

	if (!toolbarEl) {
		toolbarEl = document.createElement('div');
		toolbarEl.id = 'hero-toolbar';
	}

	if (!toolbarEl.isConnected) {
		anchor.appendChild(toolbarEl);
	}

	ensureInfoButton(toolbarEl);
	ensureButtons(toolbarEl);
};
