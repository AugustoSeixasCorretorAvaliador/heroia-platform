let observerInstance = null;
let queued = false;

export const start = (ensureToolbarCb) => {

	if (observerInstance) return;

	const runEnsure = () => {

		queued = false;

		if (typeof ensureToolbarCb === 'function') {
			ensureToolbarCb();
		}

	};

	observerInstance = new MutationObserver(() => {

		if (queued) return;

		queued = true;

		requestAnimationFrame(runEnsure);

	});

	const target = document.body || document.documentElement;

	observerInstance.observe(target, {
		childList: true,
		subtree: true
	});
};