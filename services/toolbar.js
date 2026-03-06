import { findAnchorForToolbar } from './waDom.js';
import { attachDisparoStatus } from './disparoStatus.js';

const HERO_ROOT_ID = 'hero-root';
const INFO_WRAPPER_ID = 'heroia-info-wrapper';
const INFO_BTN_ID = 'heroia-info-btn';
const INFO_POPUP_ID = 'heroia-info-popup';
const INFO_CLOSE_ID = 'heroia-info-close';

let toolbarEl = null;
let disparoBtn = null;
let allButtons = [];
const buttonsById = {};
let infoListenersBound = false;

let handlers = {
	onHeroStatus: null,
	onCoreDraft: null,
	onCoreFollowUp: null,
	onCoreRefine: null,
	onPdf: null,
	onAudio: null,
	onCredito: null,
	onDisparo: null
};

export const setHandlers = newHandlers => {
	handlers = { ...handlers, ...newHandlers };
};

const ensureHeroRoot = () => {

	let root = document.getElementById(HERO_ROOT_ID);

	if (!root) {

		root = document.createElement('div');
		root.id = HERO_ROOT_ID;

		root.style.position = 'fixed';
		root.style.left = 'auto';
		root.style.right = '12px';
		root.style.top = '50%';
		root.style.zIndex = '999999';
		root.style.display = 'flex';
		root.style.justifyContent = 'center';
		root.style.transform = 'translateY(-50%)';
		root.style.pointerEvents = 'none'; // allow WA input under it; children handle interactions

		document.documentElement.appendChild(root);
	}

	return root;
};

const createToolbar = () => {

	const el = document.createElement('div');

	el.id = 'hero-toolbar';

	el.style.display = 'flex';
	el.style.flexDirection = 'column';
	el.style.alignItems = 'center'; // center badge + buttons
	el.style.gap = '8px';
	el.style.padding = '10px 12px';
	el.style.background = '#111';
	el.style.color = '#fff';
	el.style.borderRadius = '10px';
	el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.28)';
	el.style.width = 'max-content';
	el.style.maxWidth = '320px';
	el.style.margin = '0';
	el.style.position = 'relative';
	el.style.pointerEvents = 'auto';
	el.style.boxSizing = 'border-box';

	return el;
};

const createButton = (id, label, handler, style = {}, badgeColor = null, trackLoading = true) => {

	const btn = document.createElement('button');
	btn.id = id;

	btn.style.cursor = 'pointer';
	btn.style.display = 'inline-flex';
	btn.style.alignItems = 'center';
	btn.style.gap = '6px';
	btn.style.padding = '6px 11px';
	btn.style.border = 'none';
	btn.style.borderRadius = '14px';
	btn.style.fontWeight = '600';
	btn.style.fontSize = '12.5px';
	btn.style.color = '#fff';
	btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
	btn.style.background = '#444';
	btn.style.pointerEvents = 'auto';
	btn.style.whiteSpace = 'nowrap';
	btn.style.minWidth = 'unset';
	btn.style.alignSelf = 'stretch';

	Object.assign(btn.style, style);

	// label + spinner structure
	const labelSpan = document.createElement('span');
	labelSpan.textContent = label;
	const spinner = document.createElement('span');
	spinner.textContent = '\u23F3';
	spinner.style.display = 'inline-block';
	spinner.style.marginLeft = '0';
	spinner.style.width = '0';
	spinner.style.opacity = '0';
	spinner.style.overflow = 'hidden';
	spinner.style.transition = 'width 120ms ease, opacity 120ms ease, margin 120ms ease';

	btn.appendChild(labelSpan);

	if (badgeColor) {
		const badge = document.createElement('span');
		badge.style.width = '10px';
		badge.style.height = '10px';
		badge.style.borderRadius = '50%';
		badge.style.background = badgeColor;
		badge.style.display = 'inline-block';
		badge.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.2)';
		btn.appendChild(badge);
	}

	btn.appendChild(spinner);

	btn.onmouseenter = () => {
		if (btn.disabled) return;
		btn.style.filter = 'brightness(1.07)';
		btn.style.transform = 'translateY(-1px)';
	};
	btn.onmouseleave = () => {
		btn.style.filter = 'none';
		btn.style.transform = 'translateY(0)';
	};

	btn.onclick = async () => {
		if (typeof handler !== 'function') return;
		if (trackLoading) setButtonLoading(id, true);
		try {
			await handler();
		} finally {
			if (trackLoading) setButtonLoading(id, false);
		}
	};

	allButtons.push(btn);
	buttonsById[id] = { btn, labelSpan, spinner };
	return btn;
};

export const setToolbarLoading = (isLoading = false) => {
	allButtons.forEach(btn => {
		if (!btn) return;
		const entry = buttonsById[btn.id];
		if (isLoading) {
			btn.disabled = true;
			btn.style.opacity = '0.65';
			btn.style.cursor = 'wait';
			if (entry?.spinner) {
				entry.spinner.style.width = '0.9em';
				entry.spinner.style.marginLeft = '6px';
				entry.spinner.style.opacity = '1';
			}
		} else {
			btn.disabled = false;
			btn.style.opacity = '1';
			btn.style.cursor = 'pointer';
			if (entry?.spinner) {
				entry.spinner.style.width = '0';
				entry.spinner.style.marginLeft = '0';
				entry.spinner.style.opacity = '0';
			}
		}
	});
};

export const setButtonLoading = (buttonId, isLoading = false) => {
	const entry = buttonsById[buttonId];
	if (!entry) return;
	const { btn, spinner } = entry;
	btn.disabled = !!isLoading;
	btn.style.opacity = isLoading ? '0.7' : '1';
	btn.style.cursor = isLoading ? 'wait' : 'pointer';
	if (spinner) {
		spinner.style.width = isLoading ? '0.9em' : '0';
		spinner.style.marginLeft = isLoading ? '6px' : '0';
		spinner.style.opacity = isLoading ? '1' : '0';
	}
};

// --- License info popup (HERO status) ---
const toggleInfoPopup = show => {
	const popup = document.getElementById(INFO_POPUP_ID);
	if (!popup) return;
	popup.style.display = show ? 'flex' : 'none';
};

const formatDate = value => {
	if (!value) return '—';
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

const populateInfoPopup = info => {
	const set = (id, value) => {
		const el = document.getElementById(id);
		if (el) el.textContent = value || '—';
	};
	set('hero-info-status', info.status);
	set('hero-info-email', info.email);
	set('hero-info-license', info.license);
	set('hero-info-device', info.device);
	set('hero-info-activated', formatDate(info.activatedAt));
	set('hero-info-last', formatDate(info.lastSeenAt));
	set('hero-info-version', info.version);
};

const fetchInfoAndShow = () => {
	const storage = typeof chrome !== 'undefined' ? chrome.storage?.local : null;
	const blank = () => { populateInfoPopup({}); toggleInfoPopup(true); };
	if (!storage) return blank();

	const keys = ['heroia_license', 'heroia_activation_v2', 'heroia_activation', 'heroia_license_cache'];
	try {
		storage.get(keys, data => {
			const info = data?.heroia_license
				|| data?.heroia_activation_v2
				|| data?.heroia_activation
				|| data?.heroia_license_cache
				|| {};
			const version = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest)
				? chrome.runtime.getManifest().version
				: '';
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
		blank();
	}
};

const ensureInfoStyles = () => {
	if (document.getElementById('hero-info-styles')) return;
	const style = document.createElement('style');
	style.id = 'hero-info-styles';
	style.textContent = `
		#${INFO_WRAPPER_ID} { display:flex; align-items:center; background:transparent; }
		#${INFO_BTN_ID} { border:none; background:transparent; padding:0; margin-right:8px; cursor:pointer; border-radius:50%; outline:none; box-shadow:none; }
		#${INFO_BTN_ID} img { width:36px; height:36px; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.25); display:block; border:2px solid #fff; }
		#${INFO_POPUP_ID} { position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:1000000; background:rgba(0,0,0,0.48); }
		#${INFO_POPUP_ID} .hero-info-card { position:relative; background:#10131a; color:#e9ecf2; padding:18px 20px; border-radius:12px; min-width:280px; max-width:320px; box-shadow:0 16px 40px rgba(0,0,0,0.45); opacity:1; font-family: Arial, sans-serif; }
		#${INFO_POPUP_ID} .hero-info-header { font-weight:700; margin-bottom:10px; color:#fff; }
		#${INFO_POPUP_ID} .hero-info-line { font-size:13px; margin:5px 0; display:flex; gap:6px; color:#cfd3dc; }
		#${INFO_POPUP_ID} .hero-info-line strong { color:#ffffff; }
		#${INFO_POPUP_ID} button.close { position:absolute; top:10px; right:10px; border:none; background:transparent; color:#fff; font-size:16px; cursor:pointer; }
	`;
	document.head.appendChild(style);
};

const ensureInfoButton = container => {
	let wrapper = container.querySelector(`#${INFO_WRAPPER_ID}`);
	if (!wrapper) {
		ensureInfoStyles();
		const infoImgSrc = (typeof chrome !== 'undefined' && chrome.runtime?.getURL)
			? chrome.runtime.getURL('botao.jpg')
			: 'botao.jpg';
		wrapper = document.createElement('div');
		wrapper.id = INFO_WRAPPER_ID;
		wrapper.innerHTML = `
			<button id="${INFO_BTN_ID}" title="Status da Licença HERO.IA" style="margin: 0 auto; display: block; padding: 0; background: transparent; border: none;">
				<img src="${infoImgSrc}" alt="HERO.IA Info">
			</button>
		`;
		container.prepend(wrapper);
		const btn = wrapper.querySelector(`#${INFO_BTN_ID}`);
		if (btn) {
			btn.addEventListener('click', evt => {
				evt.stopPropagation();
				fetchInfoAndShow();
			});
		}
	}

	if (!document.getElementById(INFO_POPUP_ID)) {
		const popup = document.createElement('div');
		popup.id = INFO_POPUP_ID;
		popup.innerHTML = `
			<div class="hero-info-card">
				<button class="close" id="${INFO_CLOSE_ID}" aria-label="Fechar">✕</button>
				<div class="hero-info-header">HERO.IA — Informações</div>
				<div class="hero-info-line"><strong>Status:</strong> <span id="hero-info-status">—</span></div>
				<div class="hero-info-line"><strong>Email:</strong> <span id="hero-info-email">—</span></div>
				<div class="hero-info-line"><strong>Licença:</strong> <span id="hero-info-license">—</span></div>
				<div class="hero-info-line"><strong>Device ID:</strong> <span id="hero-info-device">—</span></div>
				<div class="hero-info-line"><strong>Origem:</strong> Extensão Chrome</div>
				<div class="hero-info-line"><strong>Ativado em:</strong> <span id="hero-info-activated">—</span></div>
				<div class="hero-info-line"><strong>Último acesso:</strong> <span id="hero-info-last">—</span></div>
				<div class="hero-info-line"><strong>Versão:</strong> <span id="hero-info-version">—</span></div>
			</div>
		`;
		document.body.appendChild(popup);
	}

	if (!infoListenersBound) {
		document.addEventListener('click', evt => {
			const target = evt.target;
			if (!target) return;
			if (target.closest(`#${INFO_BTN_ID}`)) {
				evt.stopPropagation();
				return;
			}
			if (target.closest(`#${INFO_CLOSE_ID}`)) {
				toggleInfoPopup(false);
				return;
			}
			if (target.closest(`#${INFO_POPUP_ID}`)) return;
			toggleInfoPopup(false);
		});
		infoListenersBound = true;
	}
};

export const ensureToolbar = () => {

	let anchor = findAnchorForToolbar();

	if (!anchor) {
		anchor = ensureHeroRoot();
	}

	if (!toolbarEl) {

		toolbarEl = createToolbar();

		// Info badge (botao.jpg) to open license popup
		ensureInfoButton(toolbarEl);

		const buttonConfigs = [
			{ id: 'hero-btn-core-draft', label: '✍️ Gerar rascunho', handler: handlers.onCoreDraft, style: { background: '#0b80ff' }, trackLoading: true },
			{ id: 'hero-btn-core-follow', label: '🧠 Copiloto', handler: handlers.onCoreFollowUp, style: { background: '#9b6bff' }, trackLoading: true },
			{ id: 'hero-btn-refine', label: '📝 Refinar TXT', handler: handlers.onCoreRefine, style: { background: '#a14c2f' }, trackLoading: true },
			{ id: 'hero-btn-pdf', label: '📄 PDF', handler: handlers.onPdf, style: { background: '#d54132' }, trackLoading: true },
			{ id: 'hero-btn-audio', label: '🎧 Audio', handler: handlers.onAudio, style: { background: '#202020', color: '#fff' }, trackLoading: true },
			{ id: 'hero-btn-credito', label: '💰 Crédito', handler: handlers.onCredito, style: { background: '#238944' }, trackLoading: true },
			{ id: 'hero-btn-disparo', label: '📡 Disparo', handler: handlers.onDisparo, style: { background: '#f0b400', color: '#2d2d2d' }, trackLoading: true }
		];

		buttonConfigs.forEach(cfg => {
			const btn = createButton(cfg.id, cfg.label, cfg.handler, cfg.style, cfg.badgeColor, cfg.trackLoading);
			if (cfg.id === 'hero-btn-disparo') disparoBtn = btn;
			toolbarEl.appendChild(btn);
		});

	}

	// Re-anchor the toolbar if a better target appears later (e.g., once WhatsApp footer is available).
	if (!toolbarEl.isConnected || toolbarEl.parentElement !== anchor) {
		anchor.appendChild(toolbarEl);
	}

	if (disparoBtn) attachDisparoStatus(disparoBtn);
};





