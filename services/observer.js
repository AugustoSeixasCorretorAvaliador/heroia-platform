let observerInstance = null;
let queued = false;

// Create a single MutationObserver that keeps the toolbar present.
export const start = (ensureToolbarCb) => {
	if (observerInstance || typeof ensureToolbarCb !== 'function') return;

	const runEnsure = () => {
		queued = false;
		ensureToolbarCb();
	};

	ensureToolbarCb();

	observerInstance = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		// Batch DOM mutations to avoid excessive work.
		requestAnimationFrame(runEnsure);
	});

	observerInstance.observe(document.body, {
		childList: true,
		subtree: true
	});
};
