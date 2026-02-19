const DB_NAME = 'heroia_fs';
const STORE_NAME = 'directory';
const DB_VERSION = 1;
const DIRECTORY_KEY = 'pdfFolder';

let dbPromise = null;

const openDb = () => new Promise((resolve, reject) => {
	const request = indexedDB.open(DB_NAME, DB_VERSION);

	request.onupgradeneeded = () => {
		const db = request.result;
		if (!db.objectStoreNames.contains(STORE_NAME)) {
			db.createObjectStore(STORE_NAME);
		}
	};

	request.onsuccess = () => resolve(request.result);
	request.onerror = () => reject(request.error);
});

const deleteDb = () => new Promise((resolve, reject) => {
	const request = indexedDB.deleteDatabase(DB_NAME);
	request.onsuccess = () => resolve(true);
	request.onerror = () => reject(request.error);
});

const getDb = async () => {
	if (!dbPromise) dbPromise = openDb();
	try {
		return await dbPromise;
	} catch (err) {
		console.warn('HERO.IA IndexedDB reset after failure', err);
		await deleteDb();
		dbPromise = openDb();
		return dbPromise;
	}
};

const runTransaction = (mode, runner) => getDb().then(db => new Promise((resolve, reject) => {
	const tx = db.transaction(STORE_NAME, mode);
	const store = tx.objectStore(STORE_NAME);
	try {
		runner(store, resolve, reject);
	} catch (err) {
		reject(err);
	}
	tx.onerror = () => reject(tx.error);
})).catch(err => {
	console.error('HERO.IA IndexedDB transaction failed', err);
	return null;
});

export const saveDirectoryHandle = async handle => runTransaction('readwrite', (store, resolve, reject) => {
	const request = store.put(handle, DIRECTORY_KEY);
	request.onsuccess = () => resolve(true);
	request.onerror = () => reject(request.error);
});

export const getDirectoryHandle = async () => runTransaction('readonly', (store, resolve, reject) => {
	const request = store.get(DIRECTORY_KEY);
	request.onsuccess = () => resolve(request.result || null);
	request.onerror = () => reject(request.error);
});

export const clearDirectoryHandle = async () => runTransaction('readwrite', (store, resolve, reject) => {
	const request = store.delete(DIRECTORY_KEY);
	request.onsuccess = () => resolve(true);
	request.onerror = () => reject(request.error);
});
