import { getDirectoryHandle as loadHandleFromDb, saveDirectoryHandle, clearDirectoryHandle } from './indexedDb.js';

const ensureFsSupport = () => {
	if (!('showDirectoryPicker' in window)) {
		throw new Error('File System Access API não é suportada neste navegador. Use o Chrome Desktop.');
	}
};

const verifyDirectoryHandle = async handle => {
	if (!handle) return false;
	try {
		// Touch the iterator to confirm access and existence.
		for await (const _ of handle.values()) {
			break;
		}
		return true;
	} catch (err) {
		if (err?.name === 'NotFoundError' || err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
			return false;
		}
		throw err;
	}
};

export const ensurePermission = async handle => {
	if (!handle?.queryPermission) return false;
	const queryState = await handle.queryPermission({ mode: 'read' });
	if (queryState === 'granted') return true;
	const requestState = await handle.requestPermission({ mode: 'read' });
	return requestState === 'granted';
};

export const saveHandle = async handle => {
	if (!handle) return null;
	await saveDirectoryHandle(handle);
	return handle;
};

export const getHandle = async () => loadHandleFromDb();

export const requestDirectory = async () => {
	ensureFsSupport();
	try {
		const handle = await window.showDirectoryPicker();
		const allowed = await ensurePermission(handle);
		if (!allowed) return null;
		await saveHandle(handle);
		return handle;
	} catch (err) {
		if (err?.name === 'AbortError') return null;
		throw err;
	}
};

export const reconnectFlow = async () => {
	await clearDirectoryHandle();
	return requestDirectory();
};

export const getUsableDirectoryHandle = async () => {
	let handle = await getHandle();
	if (handle) {
		const allowed = await ensurePermission(handle);
		const usable = allowed && await verifyDirectoryHandle(handle);
		if (!usable) handle = null;
	}
	if (!handle) {
		handle = await requestDirectory();
	}
	return handle;
};
