const normalizeType = type => (type || '')
	.toString()
	.normalize('NFD')
	.replace(/[^\p{L}\p{N}]/gu, '')
	.toUpperCase();

const normalizeName = name => (name || '')
	.toString()
	.normalize('NFD')
	.replace(/[\u0300-\u036f]/g, '')
	.toUpperCase();

const isPdfName = name => name && name.toLowerCase().endsWith('.pdf');

export const validatePrefix = (name, type) => {
	if (!name || !type) return false;
	const normalizedType = normalizeType(type);
	const normalizedName = normalizeName(name);
	const firstToken = normalizedName.split(/[\s_-]+/)[0];
	return firstToken === normalizedType;
};

const formatDisplayName = name => {
	const withoutExt = name.replace(/\.pdf$/i, '');
	const stripped = withoutExt.replace(/^([^\s_-]+)(__|[\s_-]+)+/i, '').trim();
	return stripped || withoutExt;
};

export const listFilesByType = async (directoryHandle, type) => {
	if (!directoryHandle) throw new Error('Nenhuma pasta de PDF configurada.');
	const normalizedType = normalizeType(type);
	const items = [];

	try {
		for await (const entry of directoryHandle.values()) {
			if (entry.kind !== 'file') continue;
			if (!isPdfName(entry.name)) continue;
			if (!validatePrefix(entry.name, normalizedType)) continue;
			items.push({ name: entry.name, displayName: formatDisplayName(entry.name) });
		}
	} catch (err) {
		if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
			throw new Error('Permissão para acessar a pasta de PDFs foi negada.');
		}
		if (err?.name === 'NotFoundError') {
			throw new Error('A pasta de PDFs não foi encontrada.');
		}
		throw err;
	}

	items.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
	return items;
};

export const getFileByName = async (directoryHandle, name) => {
	if (!directoryHandle) throw new Error('Pasta de PDF não conectada.');
	if (!name) throw new Error('Nenhum arquivo selecionado.');
	try {
		const fileHandle = await directoryHandle.getFileHandle(name, { create: false });
		return fileHandle.getFile();
	} catch (err) {
		if (err?.name === 'NotFoundError') {
			throw new Error('Arquivo não encontrado na pasta configurada.');
		}
		if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
			throw new Error('Sem permissão para acessar a pasta de PDFs.');
		}
		throw err;
	}
};
