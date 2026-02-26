(() => {
	let cachedModules = null;

	const loadModules = async () => {
		if (cachedModules) return cachedModules;
		cachedModules = Promise.all([
			import(chrome.runtime.getURL('services/observer.js')),
			import(chrome.runtime.getURL('services/toolbar.js')),
			import(chrome.runtime.getURL('modules/core.js')),
			import(chrome.runtime.getURL('modules/refine.js')),
			import(chrome.runtime.getURL('modules/pdf.js')),
			import(chrome.runtime.getURL('modules/audio.js')),
			import(chrome.runtime.getURL('modules/credito.js'))
		]).then(([observer, toolbar, core, refine, pdf, audio, credito]) => ({
			observer,
			toolbar,
			core,
			refine,
			pdf,
			audio,
			credito,
		}));
		return cachedModules;
	};

	const wireHandlers = (toolbar, core, refine, pdf, audio, credito) => {
		toolbar.setHandlers({
			onCoreDraft: core.runCoreDraft,
			onCoreFollowUp: core.runCoreFollowUp,
			onCoreRefine: refine.runRefine,
			onPdf: pdf.runPdf,
			onAudio: audio.runAudio,
			onCredito: credito.runCredito,
			onDisparo: () => {
				try {
					window.open('http://localhost:3000', '_blank', 'noopener');
				} catch (err) {
					console.error('HERO IA disparo open error', err);
				}
			}
		});
	};

	const init = async () => {
		try {
			const { observer, toolbar, core, refine, pdf, audio, credito } = await loadModules();
			wireHandlers(toolbar, core, refine, pdf, audio, credito);
			observer.start(toolbar.ensureToolbar);
		} catch (err) {
			console.error('HERO IA init failed', err);
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();
