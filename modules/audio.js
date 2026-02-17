/*
 * Botão "Transcrever Áudio" para WhatsApp Web (Manifest V3).
 * Fluxo: encontra o ÚLTIMO áudio RECEBIDO no chat -> captura bytes -> manda ao background -> transcreve com OpenAI -> insere texto no composer.
 * Observação: API key fica em chrome.storage local (risco client-side, ideal é backend próprio).
 *
 * Adaptado para o toolbar unificado: não injeta botão próprio, apenas expõe runAudio.
 */

const PREFIX = '[HERO-AUDIO]';
const BUTTON_ID = 'hero-audio-transcribe-btn';
const TOAST_ID = 'hero-audio-toast';
const Z_DEFAULT = 2147483645;
const STATE = { isTranscribing: false, lastChatTitle: null };
const MAX_SHADOW_SCAN = 3000;
const CAPTURE_TTL_MS = 2 * 60 * 1000;
const MEDIA_BUFFER_WINDOW_MS = 4000;

function rememberCapturedAudio(base64, mimeType, src) {
	STATE.lastCapturedAudio = { base64, mimeType: mimeType || 'audio/ogg', src, ts: Date.now() };
}

function getCapturedAudioIfFresh() {
	const c = STATE.lastCapturedAudio;
	if (!c) return null;
	if (Date.now() - c.ts > CAPTURE_TTL_MS) return null;
	return c;
}

function log(...args) {
	console.debug(PREFIX, ...args);
}

function showToast(message, isError = false) {
	let toast = document.getElementById(TOAST_ID);
	if (!toast) {
		toast = document.createElement('div');
		toast.id = TOAST_ID;
		toast.style.position = 'fixed';
		toast.style.bottom = '92px';
		toast.style.right = '18px';
		toast.style.padding = '10px 14px';
		toast.style.borderRadius = '10px';
		toast.style.background = 'rgba(0,0,0,0.86)';
		toast.style.color = '#fff';
		toast.style.fontSize = '13px';
		toast.style.zIndex = '2147483646';
		toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
		toast.style.maxWidth = '320px';
		toast.style.lineHeight = '1.4';
		document.body.appendChild(toast);
	}
	toast.textContent = message;
	toast.style.background = isError ? 'rgba(200,40,40,0.92)' : 'rgba(0,0,0,0.86)';
	toast.style.display = 'block';
	setTimeout(() => { toast.style.display = 'none'; }, 3200);
}

function startNetworkAudioSniffer() {
	if (STATE.snifferStarted) return;
	STATE.snifferStarted = true;
	log('Sniffer de rede iniciado para capturar áudios.');

	try {
		const OriginalMS = window.MediaSource;
		const OriginalSB = window.SourceBuffer;
		const streamCapture = { buffers: [], mime: null, lastTs: 0 };

		if (!OriginalMS || !OriginalSB) throw new Error('MediaSource/SourceBuffer indisponível');

		const pushStreamBuffer = (buffer, mime, sourceLabel) => {
			try {
				if (!buffer || !buffer.byteLength) return;
				const copy = (() => {
					if (buffer instanceof ArrayBuffer) return buffer.slice(0);
					if (ArrayBuffer.isView(buffer)) {
						const { buffer: buf, byteOffset, byteLength } = buffer;
						return buf.slice(byteOffset, byteOffset + byteLength);
					}
					if (buffer.slice) return buffer.slice(0);
					return null;
				})();
				if (!copy) return;
				streamCapture.buffers.push(copy);
				streamCapture.mime = mime || streamCapture.mime || 'audio/ogg';
				streamCapture.lastTs = Date.now();
				rememberCapturedAudio(arrayBufferToBase64(copy), streamCapture.mime, sourceLabel);
				log('Capturado buffer via stream', sourceLabel || 'desconhecido');
			} catch (err) {
				// ignora
			}
		};

		function flushCapturedBuffers() {
			if (!streamCapture.buffers.length) return null;
			if (Date.now() - streamCapture.lastTs > CAPTURE_TTL_MS) {
				streamCapture.buffers = [];
				return null;
			}
			const total = streamCapture.buffers.reduce((acc, b) => acc + b.byteLength, 0);
			const merged = new Uint8Array(total);
			let offset = 0;
			streamCapture.buffers.forEach((b) => {
				merged.set(new Uint8Array(b), offset);
				offset += b.byteLength;
			});
			streamCapture.buffers = [];
			const mime = streamCapture.mime || 'audio/ogg';
			const base64 = arrayBufferToBase64(merged.buffer);
			rememberCapturedAudio(base64, mime, 'mediasource-flush');
			log('Buffers combinados de MediaSource/SourceBuffer', total);
			return { base64, mimeType: mime };
		}

		window.MediaSource = function (...args) {
			const ms = new OriginalMS(...args);
			const origAdd = ms.addSourceBuffer.bind(ms);
			ms.addSourceBuffer = function (mime) {
				const sb = origAdd(mime);
				if (sb && sb.appendBuffer) {
					const origAppend = sb.appendBuffer.bind(sb);
					sb.appendBuffer = function (buffer) {
						pushStreamBuffer(buffer, mime || sb.type || 'audio/ogg', 'mediasource');
						return origAppend(buffer);
					};
				}
				return sb;
			};
			return ms;
		};

		if (OriginalMS?.isTypeSupported) {
			window.MediaSource.isTypeSupported = OriginalMS.isTypeSupported.bind(OriginalMS);
		}
		window.MediaSource.prototype = OriginalMS.prototype;

		if (OriginalSB && OriginalSB.prototype && OriginalSB.prototype.appendBuffer) {
			const origAppend = OriginalSB.prototype.appendBuffer;
			OriginalSB.prototype.appendBuffer = function (buffer) {
				pushStreamBuffer(buffer, this?.type || 'audio/ogg', 'sourcebuffer');
				return origAppend.call(this, buffer);
			};
		}

		STATE.flushCapturedBuffers = flushCapturedBuffers;
	} catch (err) {
		log('Intercept MediaSource falhou', err?.message);
	}

	const urlLooksLikeAudio = (url = '') => {
		const lowered = url.toLowerCase();
		if (lowered.startsWith('blob:') || lowered.startsWith('data:audio')) return true;
		return /(\.opus|\.ogg|\.oga|\.mp3|\.m4a|\.aac|\.wav)(\?|$)/i.test(url) || lowered.includes('voice') || lowered.includes('audio');
	};

	const tryCaptureResponse = async (resp, urlHint) => {
		try {
			const ct = resp.headers?.get?.('content-type') || '';
			if (!ct.toLowerCase().includes('audio') && !urlLooksLikeAudio(urlHint || '')) return;
			const clone = resp.clone();
			const buf = await clone.arrayBuffer();
			const base64 = arrayBufferToBase64(buf);
			const mime = ct || 'audio/ogg';
			rememberCapturedAudio(base64, mime, urlHint || '');
			log('Capturado áudio via fetch/XHR', (urlHint || '').slice(0, 120));
		} catch (err) {
			// silencioso
		}
	};

	const originalFetch = window.fetch;
	window.fetch = async (...args) => {
		const url = args[0];
		const resp = await originalFetch(...args);
		tryCaptureResponse(resp, typeof url === 'string' ? url : url?.url);
		return resp;
	};

	const OriginalXHR = window.XMLHttpRequest;
	function WrappedXHR() {
		const xhr = new OriginalXHR();
		let url = '';
		const origOpen = xhr.open;
		xhr.open = function (...openArgs) {
			url = openArgs[1] || '';
			return origOpen.apply(xhr, openArgs);
		};
		xhr.addEventListener('load', () => {
			if (xhr.responseType === 'arraybuffer' || xhr.responseType === 'blob' || xhr.responseType === '') {
				const respType = xhr.getResponseHeader('content-type') || '';
				if (!respType.toLowerCase().includes('audio') && !urlLooksLikeAudio(url)) return;
				const data = xhr.response;
				if (!data) return;
				const toBuffer = async () => {
					if (data instanceof ArrayBuffer) return data;
					if (data instanceof Blob) return data.arrayBuffer();
					if (typeof data === 'string') return new TextEncoder().encode(data).buffer;
					return null;
				};
				toBuffer()
					.then((buf) => {
						if (!buf) return;
						const base64 = arrayBufferToBase64(buf);
						rememberCapturedAudio(base64, respType || 'audio/ogg', url || '');
						log('Capturado áudio via XHR', (url || '').slice(0, 120));
					})
					.catch(() => {});
			}
		});
		return xhr;
	}
	window.XMLHttpRequest = WrappedXHR;
}

function getAllRoots() {
	const roots = [document];
	const frames = Array.from(document.querySelectorAll('iframe'));
	frames.forEach((frame) => {
		try { if (frame.contentDocument) roots.push(frame.contentDocument); } catch (err) { log('Iframe inacessível', err?.message); }
	});
	try {
		const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT);
		let count = 0;
		while (walker.nextNode()) {
			const el = walker.currentNode;
			if (el.shadowRoot) roots.push(el.shadowRoot);
			count += 1;
			if (count > MAX_SHADOW_SCAN) break;
		}
	} catch (err) { log('Walker falhou', err?.message); }
	return roots;
}

function queryAllRoots(selector) {
	const roots = getAllRoots();
	const results = [];
	roots.forEach((root) => {
		try { results.push(...root.querySelectorAll(selector)); } catch (err) { log('queryAllRoots erro', selector, err?.message); }
	});
	return results;
}

function findComposerInput() {
	const selectors = [
		"footer div[contenteditable='true'][data-testid='conversation-compose-box-input']",
		"footer div[contenteditable='true'][role='textbox']",
		"footer div[contenteditable='true'][data-tab]",
		"footer [contenteditable='true']",
		"div[contenteditable='true'][data-testid='conversation-compose-box-input']",
		"div[contenteditable='true'][role='textbox']",
	];
	const roots = getAllRoots();
	for (const root of roots) {
		for (const sel of selectors) {
			try {
				const el = root.querySelector(sel);
				if (el) return el;
			} catch (err) {}
		}
	}
	return null;
}

function findMicButton() {
	const selectors = [
		"button[data-icon='ptt']",
		"button[data-testid='ptt']",
		"button[aria-label*='Gravar']",
		"button[aria-label*='microfone']",
		"button[aria-label*='microphone']",
		"footer button[aria-label*='Mensagem de voz']",
		"footer button[aria-label*='Voice message']",
		"footer button[aria-label*='Mensagem de voz'] svg",
		"footer button[aria-label*='Voice message'] svg",
	];
	for (const sel of selectors) {
		const el = document.querySelector(sel);
		if (el) return el.closest('button') || el;
	}
	const footer = document.querySelector('footer');
	if (footer) {
		const buttons = footer.querySelectorAll('button');
		if (buttons.length > 0) return buttons[buttons.length - 1];
	}
	return null;
}

function getMessageListContainer() {
	const selectors = [
		"[data-testid='conversation-panel-messages']",
		"main [role='grid']",
		"div[role='grid']",
		'main section',
		'main',
	];
	for (const sel of selectors) {
		const found = queryAllRoots(sel)[0];
		if (found) return found;
	}
	return document.body;
}

function isInboundMessage(node) {
	const cls = (node.className || '').toString();
	if (cls.includes('message-in')) return true;
	if (cls.includes('message-out')) return false;
	const testid = node.getAttribute?.('data-testid') || '';
	if (testid.includes('msg-container') && !cls.includes('message-out')) return true;
	if (testid.toLowerCase().includes('inbound')) return true;
	const aria = node.getAttribute?.('aria-label') || '';
	if (aria.toLowerCase().includes('recebida') || aria.toLowerCase().includes('received')) return true;
	return false;
}

function findCandidateMessages() {
	const container = getMessageListContainer();
	if (!container) return [];
	const selectors = [
		"[data-testid='msg-container']",
		"[role='row']",
		"div[class*='message-']",
		"div[data-testid*='audio']",
		"div[data-testid*='voice']",
		"div[aria-label*='mensagem de voz']",
		"div[aria-label*='voice message']",
	];
	const nodes = selectors.flatMap((sel) => Array.from(container.querySelectorAll(sel)));
	return Array.from(new Set(nodes)).filter((n) => isInboundMessage(n));
}

function extractAudioInfoFromMessage(msg) {
	const audioEl = msg.querySelector('audio');
	if (audioEl && (audioEl.currentSrc || audioEl.src)) {
		return { src: audioEl.currentSrc || audioEl.src, mimeType: audioEl.getAttribute('type') || audioEl.type || 'audio/ogg' };
	}
	const source = msg.querySelector('source');
	if (source && (source.src || source.getAttribute('src'))) {
		return { src: source.src || source.getAttribute('src'), mimeType: source.type || 'audio/ogg' };
	}
	const playButton = msg.querySelector(
		"[data-testid*='audio-play'], [data-testid*='voice-play'], [data-icon*='audio'], button[aria-label*='audio'], button[aria-label*='Áudio'], button[aria-label*='mensagem de voz'], button[aria-label*='voice message']"
	);
	const dataUrl = playButton?.getAttribute?.('data-url');
	if (dataUrl) return { src: dataUrl, mimeType: 'audio/ogg' };
	return null;
}

function findLastInboundAudio() {
	const candidates = findCandidateMessages();
	for (let i = candidates.length - 1; i >= 0; i -= 1) {
		const info = extractAudioInfoFromMessage(candidates[i]);
		if (info?.src) return info;
	}
	const audios = queryAllRoots('audio').reverse();
	for (const audio of audios) {
		const hostMsg = audio.closest("[data-testid='msg-container'], [role='row'], div[class*='message-']");
		if (hostMsg && !hostMsg.className.toString().includes('message-out')) {
			const src = audio.currentSrc || audio.src;
			if (src) return { src, mimeType: audio.getAttribute('type') || audio.type || 'audio/ogg' };
		}
	}
	const playing = findPlayingAudioFallback();
	if (playing) return playing;
	if (STATE.flushCapturedBuffers) {
		const flushed = STATE.flushCapturedBuffers();
		if (flushed?.base64) return { src: 'captured-mediasource', mimeType: flushed.mimeType, base64: flushed.base64 };
	}
	const captured = getCapturedAudioIfFresh();
	if (captured) return { src: captured.src || 'captured-via-network', mimeType: captured.mimeType, base64: captured.base64 };
	return null;
}

async function fetchAudioAsBase64(src) {
	const resp = await fetch(src);
	if (!resp.ok) throw new Error(`Falha ao baixar o áudio (${resp.status})`);
	const buf = await resp.arrayBuffer();
	const mimeType = resp.headers.get('content-type') || undefined;
	return { base64: arrayBufferToBase64(buf), mimeType };
}

function buildConfirmationMessage(transcribedText) {
	const clean = (transcribedText || '').trim();
	if (!clean) {
		return 'Não consegui transcrever com clareza esse áudio. Você pode me mandar novamente ou escrever um resumo em 1 frase?';
	}
	return `Escutei seu áudio e, para confirmar se entendi direitinho, segue em texto o que você disse:\n\n“ ${clean} ”\n\nSe estiver correto, me confirma com um OK que eu já te respondo com os próximos passos.`;
}

function insertIntoComposer(text) {
	const composer = findComposerInput();
	if (!composer) return false;
	composer.focus();
	const normalized = (text || '').replace(/\r\n/g, '\n');
	composer.innerHTML = '';
	const lines = normalized.split('\n');
	lines.forEach((line, idx) => {
		if (idx > 0) composer.appendChild(document.createElement('br'));
		composer.appendChild(document.createTextNode(line));
	});
	try {
		const sel = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(composer);
		range.collapse(false);
		sel.removeAllRanges();
		sel.addRange(range);
	} catch (err) {}
	composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: normalized }));
	return true;
}

function findLastPlayButton() {
	const container = getMessageListContainer();
	if (!container) return null;
	const selectors = [
		"button[data-testid*='audio-play']",
		"button[data-testid*='voice-play']",
		"button[data-testid*='ptt-play']",
		"button[aria-label*='mensagem de voz']",
		"button[aria-label*='Mensagem de voz']",
		"button[aria-label*='voice message']",
		"div[aria-label*='mensagem de voz'] button",
		"div[aria-label*='voice message'] button",
		"div[aria-label*='áudio'] button",
		"button[aria-label*='áudio']",
	];
	const buttons = selectors.flatMap((sel) => Array.from(container.querySelectorAll(sel)));
	if (!buttons.length) return null;
	return buttons[buttons.length - 1];
}

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function waitForNewAudioElement(timeoutMs = 2000) {
	return new Promise((resolve) => {
		const start = Date.now();
		const check = () => {
			const audios = queryAllRoots('audio');
			if (audios.length) {
				resolve(audios[audios.length - 1]);
				return;
			}
			if (Date.now() - start >= timeoutMs) {
				resolve(null);
				return;
			}
			requestAnimationFrame(check);
		};
		check();
	});
}

function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

function findPlayingAudioFallback() {
	const audios = queryAllRoots('audio');
	const playing = audios.find((a) => !a.paused && (a.currentSrc || a.src));
	if (playing) {
		const src = playing.currentSrc || playing.src;
		return src ? { src, mimeType: playing.getAttribute('type') || playing.type || 'audio/ogg' } : null;
	}
	return null;
}

function getChatTitle() {
	const header = document.querySelector("header [data-testid='conversation-info-header']") || document.querySelector('header');
	const title = header?.innerText?.trim();
	return title || null;
}

function sendMessagePromise(payload) {
	return new Promise((resolve) => chrome.runtime.sendMessage(payload, resolve));
}

async function promptAndSaveKey() {
	const key = window.prompt('Informe sua OpenAI API key (começa com sk-). Ela será salva localmente.');
	if (!key) throw new Error('API key não fornecida.');
	const saveResp = await sendMessagePromise({ type: 'SET_API_KEY', apiKey: key });
	if (!saveResp?.ok) throw new Error(saveResp?.error || 'Falha ao salvar API key.');
	showToast('API key salva. Clique novamente para transcrever.');
}

async function onTranscribeClick() {
	if (STATE.isTranscribing) return;
	STATE.isTranscribing = true;
	try {
		startNetworkAudioSniffer();
		const chatTitle = getChatTitle();
		STATE.lastChatTitle = chatTitle;
		let audioInfo = findLastInboundAudio();

		if (!audioInfo?.src) {
			const playBtn = findLastPlayButton();
			if (playBtn) {
				log('Tentando tocar último áudio via botão de play');
				const audioPromise = waitForNewAudioElement(2000);
				playBtn.click();
				await wait(1200);
				const playing = findPlayingAudioFallback();
				if (playing?.src) audioInfo = playing;
				if (!audioInfo?.src) {
					const newAudio = await audioPromise;
					if (newAudio) {
						const src = newAudio.currentSrc || newAudio.src;
						if (src) audioInfo = { src, mimeType: newAudio.getAttribute('type') || newAudio.type || 'audio/ogg' };
					}
				}
			}
		}

		if (!audioInfo?.src) {
			const captured = getCapturedAudioIfFresh();
			if (captured) {
				audioInfo = { src: captured.src || 'captured-via-network', mimeType: captured.mimeType, base64: captured.base64 };
				log('Usando áudio capturado via rede');
			}
		}

		if (!audioInfo?.src) {
			const downloadResp = await sendMessagePromise({ type: 'GET_LAST_AUDIO_DOWNLOAD' });
			if (downloadResp?.ok && downloadResp.downloadUrl) {
				audioInfo = { src: downloadResp.downloadUrl, mimeType: downloadResp.mimeType || 'audio/ogg', filePath: downloadResp.filePath, useUrlFetch: true };
				log('Usando áudio do último download');
			}
		}

		if (!audioInfo?.src) {
			showToast('Não encontrei nenhum áudio recebido neste chat.', true);
			return;
		}
		log('Último áudio detectado', audioInfo.src.slice(0, 120));

		let fetched;
		let payload;
		if (audioInfo.base64) {
			payload = {
				type: 'TRANSCRIBE_WHATSAPP_AUDIO',
				audioBase64: audioInfo.base64,
				mimeType: audioInfo.mimeType || 'audio/ogg',
				source: 'last-inbound-audio',
				chatId: chatTitle,
			};
		} else if (audioInfo.useUrlFetch) {
			payload = {
				type: 'TRANSCRIBE_WHATSAPP_AUDIO',
				audioUrl: audioInfo.src,
				mimeType: audioInfo.mimeType || 'audio/ogg',
				source: 'download-audio',
				chatId: chatTitle,
				filePath: audioInfo.filePath,
			};
		} else {
			fetched = await fetchAudioAsBase64(audioInfo.src);
			payload = {
				type: 'TRANSCRIBE_WHATSAPP_AUDIO',
				audioBase64: fetched.base64,
				mimeType: audioInfo.mimeType || fetched.mimeType || 'audio/ogg',
				source: 'last-inbound-audio',
				chatId: chatTitle,
				filePath: audioInfo.filePath,
			};
		}

		const response = await sendMessagePromise(payload);
		if (!response?.ok) {
			if (response?.needsKey) {
				await promptAndSaveKey();
				STATE.isTranscribing = false;
				return onTranscribeClick();
			}
			throw new Error(response?.error || 'Falha ao transcrever.');
		}

		const finalText = buildConfirmationMessage(response.text);
		const inserted = insertIntoComposer(finalText);
		if (!inserted) log('Composer não encontrado; texto não inserido');
		showToast('Transcrição pronta! Confirme e envie.');
		log('Transcrição concluída', finalText);
	} catch (err) {
		log('Erro no fluxo', err?.message || err);
		showToast(err?.message || 'Falha na transcrição.', true);
	} finally {
		STATE.isTranscribing = false;
	}
}

startNetworkAudioSniffer();

export const runAudio = onTranscribeClick;
