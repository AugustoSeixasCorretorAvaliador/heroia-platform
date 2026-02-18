const HEALTH_URL = 'http://localhost:3000/health';
const TIMEOUT_MS = 1500;

const fetchHealthViaBackground = () => new Promise(resolve => {
	try {
		if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
			chrome.runtime.sendMessage({ type: 'HEALTH_CHECK', url: HEALTH_URL, timeout: TIMEOUT_MS }, resp => {
				if (resp?.status === 'online') {
					resolve('online');
					return;
				}
				resolve('offline');
			});
			return;
		}
	} catch (err) {
		// fallback below
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	fetch(HEALTH_URL, { signal: controller.signal })
		.then(res => resolve(res.ok ? 'online' : 'offline'))
		.catch(() => resolve('offline'))
		.finally(() => clearTimeout(timer));
});

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
		if (status === 'online') {
			badge.classList.add('hero-disparo-online');
		} else if (status === 'offline') {
			badge.classList.add('hero-disparo-offline');
		}
	};

	const runHealthCheck = async (force = false) => {
		if (isChecking) return lastStatus;
		if (!force && hasChecked) return lastStatus;
		isChecking = true;
		setTooltip(null);
		let status = 'offline';
		try {
			status = await fetchHealthViaBackground();
		} catch (err) {
			status = 'offline';
		} finally {
			isChecking = false;
			hasChecked = true;
			lastStatus = status;
			setBadge(status);
			setTooltip(status);
		}
		return status;
	};

	buttonEl._heroDisparoCheck = (force = false) => runHealthCheck(force);

	buttonEl.addEventListener('mouseenter', () => {
		if (!hasChecked) {
			runHealthCheck(true);
			return;
		}
		setTooltip(lastStatus);
	});

	buttonEl.addEventListener('click', () => {
		hasChecked = false;
		runHealthCheck(true);
	});

	setBadge(lastStatus);
	setTooltip(lastStatus);
}
