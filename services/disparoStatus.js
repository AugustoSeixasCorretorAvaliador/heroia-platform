const HEALTH_URL = 'http://localhost:3000/health';
const TIMEOUT_MS = 1500;

export function attachDisparoStatus(buttonEl) {
	if (!buttonEl || buttonEl.dataset.heroDisparoBound === '1') return;
	buttonEl.dataset.heroDisparoBound = '1';

	let hasChecked = false;
	let isChecking = false;
	let lastStatus = null; // 'online' | 'offline'

	const ensureBadge = () => {
		let badge = buttonEl.querySelector('.hero-disparo-status');
		if (!badge) {
			badge = document.createElement('span');
			badge.className = 'hero-disparo-status';
			buttonEl.appendChild(badge);
		}
		return badge;
	};

	const setTooltip = status => {
		const msg = status === 'online'
			? 'Servidor ativo'
			: status === 'offline'
				? 'Servidor offline'
				: 'Verificando servidor...';
		buttonEl.setAttribute('title', msg);
	};

	const setBadge = status => {
		const badge = ensureBadge();
		badge.classList.remove('hero-disparo-online', 'hero-disparo-offline');
		badge.textContent = '';
		if (status === 'online') {
			badge.classList.add('hero-disparo-online');
			badge.textContent = '';
		} else if (status === 'offline') {
			badge.classList.add('hero-disparo-offline');
			badge.textContent = '';
		}
	};

	const runHealthCheck = async () => {
		if (isChecking) return lastStatus;
		isChecking = true;
		setTooltip(null);
		let controller;
		let timer;
		let status = 'offline';
		try {
			controller = new AbortController();
			timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
			const res = await fetch(HEALTH_URL, { signal: controller.signal });
			if (res.ok) status = 'online';
		} catch (err) {
			status = 'offline';
		} finally {
			clearTimeout(timer);
			isChecking = false;
			hasChecked = true;
			lastStatus = status;
			setBadge(status);
			setTooltip(status);
		}
		return status;
	};

	buttonEl.addEventListener('mouseenter', () => {
		if (!hasChecked) {
			runHealthCheck();
			return;
		}
		setTooltip(lastStatus);
	});

	buttonEl.addEventListener('click', () => {
		hasChecked = false;
		runHealthCheck();
	});

	// Initial badge render (neutral)
	setBadge(lastStatus);
	setTooltip(lastStatus);
}
