
const API_BASE = "https://heroia-full-nuven-1.onrender.com";
const STORAGE_ACTIVATION = "heroia_activation_v2";
const STORAGE_DEVICE = "heroia_device_id";
const PANEL_ID = "heroia-analysis-panel";

const state = { loadingDraft: false, loadingCopilot: false };

function getComposer() {
	return document.querySelector('footer [contenteditable="true"][role="textbox"]')
		|| document.querySelector('div[contenteditable="true"][role="textbox"]');
}

function getComposerText() {
	const editor = getComposer();
	if (!editor) return "";
	return (editor.innerText || editor.textContent || "").trim();
}

function selectComposerAll() {
	const editor = getComposer();
	if (!editor) return;
	editor.focus();
	const sel = window.getSelection && window.getSelection();
	if (!sel) return;
	sel.removeAllRanges();
	const range = document.createRange();
	range.selectNodeContents(editor);
	sel.addRange(range);
}

function buildRewriteInsights(text) {
	const t = (text || "").toLowerCase();
	const bullets = [];
	if (t.includes("fgts") || t.includes("financi")) bullets.push("Mostra claramente como usar FGTS e financiar sem surpresa.");
	if (t.includes("parcela") || t.includes("prest")) bullets.push("Entrega a parcela exata e o teto de compra, reduzindo insegurança.");
	if (t.includes("document")) bullets.push("Lista documentos e passa seriedade no processo.");
	if (t.includes("seguran") || t.includes("tranqui")) bullets.push("Refuerça segurança e tranquilidade na decisão.");
	if (!bullets.length) bullets.push("Texto lapidado para ficar claro, consultivo e sem pressão.");
	return [
		"Insights do texto lapidado:",
		...bullets.map((b) => `- ${b}`),
		"Pronto para colar no WhatsApp."
	].join("\n");
}

function fixCommonTypos(text = "") {
	const replacements = [
		[/\bcertidao(es)?\b/gi, (m, plural) => plural ? "certidões" : "certidão"],
		[/\baprovac\w*/gi, "aprovação"],
		[/\bimovel\b/gi, "imóvel"],
		[/\bimoveis\b/gi, "imóveis"],
	];
	return replacements.reduce((acc, [re, val]) => acc.replace(re, val), text);
}

function sanitizeComposerVisual(text = "") {
	if (!text) return "";
	let t = text;
	t = t.replace(/^\*\s+/gm, "• ");
	t = t.replace(/([A-Za-zÀ-ÿ])\*([A-Za-zÀ-ÿ])/g, "$1$2");
	t = t.replace(/\*/g, "•");
	return t;
}

function parseAuthor(attr = "") {
	const lower = attr.toLowerCase();
	if (lower.includes("você:")) return "corretor";
	return "cliente";
}

function getChatRoot() {
	return document.querySelector('div[role="application"]')
		|| document.querySelector('div[role="main"]')
		|| document.body;
}

function collectCopilotMessages(limit = 16) {
	const root = getChatRoot();
	const nodes = Array.from(root.querySelectorAll("[data-pre-plain-text]"));
	const msgs = nodes.map((node) => {
		const meta = node.getAttribute("data-pre-plain-text") || "";
		const text = (node.innerText || node.textContent || "").trim();
		if (!text) return null;
		return { author: parseAuthor(meta), text };
	}).filter(Boolean);
	return msgs.slice(-limit);
}

function extractInboundMessages(limit = 3) {
	const root = getChatRoot();
	const dataElements = Array.from(root.querySelectorAll("[data-pre-plain-text]"));

	const BOT_MARKERS = [
		"creci-rj",
		"compra • venda",
		"compra • venda • aluguel",
	];

	const isBotText = (text = "") => {
		const t = text.toLowerCase();
		return BOT_MARKERS.some((m) => t.includes(m));
	};

	const messages = dataElements.map((el) => {
		const text = (el.innerText || el.textContent || "").trim();
		const attr = el.getAttribute("data-pre-plain-text") || "";
		const match = attr.match(/\]\s*([^:]+):/);
		const author = match?.[1]?.trim() || "";
		const isSelf = /^(v(o|ó|ô|ò)ce|vc|you)$/i.test(author);
		return { text, isSelf };
	}).filter((m) => m.text && !isBotText(m.text));

	const inbound = messages.filter((m) => !m.isSelf);
	if (!inbound.length) return [];
	return inbound.slice(-limit).map((m) => m.text);
}

function insertTextInComposer(text, { append = false } = {}) {
	const editor = getComposer();
	if (!editor) return false;
	const safeText = String(text || "").replace(/\u00a0/g, " ").normalize("NFC");

	const existingRaw = append ? (editor.innerText || editor.textContent || "") : "";
	const existing = existingRaw.replace(/\u00a0/g, " ").normalize("NFC");
	const separator = append ? "\n\n" : "";
	const finalText = append ? `${existing.trimEnd()}${separator}${safeText}` : safeText;

	editor.innerHTML = "";
	const parts = finalText.split("\n");
	parts.forEach((line, idx) => {
		editor.appendChild(document.createTextNode(line));
		if (idx < parts.length - 1) editor.appendChild(document.createElement("br"));
	});

	editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: finalText, inputType: "insertFromPaste" }));
	editor.dispatchEvent(new Event("change", { bubbles: true }));
	return true;
}

function isComposerFullySelected(currentText) {
	const editor = getComposer();
	if (!editor) return false;
	const sel = window.getSelection && window.getSelection();
	if (!sel || sel.rangeCount === 0) return false;
	const selected = (sel.toString() || "").trim();
	const base = String(currentText || "").trim();
	return selected && selected.length >= base.length - 1;
}

function clearComposer() {
	const editor = getComposer();
	if (!editor) return;
	editor.focus();
	try {
		const sel = window.getSelection && window.getSelection();
		if (sel) {
			sel.removeAllRanges();
			const range = document.createRange();
			range.selectNodeContents(editor);
			sel.addRange(range);
		}
		document.execCommand("selectAll", false, null);
		document.execCommand("delete", false, null);
	} catch (e) {}
	editor.innerHTML = "";

	const backspaceDown = new KeyboardEvent("keydown", { key: "Backspace", code: "Backspace", keyCode: 8, which: 8, bubbles: true, cancelable: true });
	const backspaceUp = new KeyboardEvent("keyup", { key: "Backspace", code: "Backspace", keyCode: 8, which: 8, bubbles: true, cancelable: true });
	editor.dispatchEvent(backspaceDown);
	editor.dispatchEvent(backspaceUp);

	editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: "", inputType: "deleteContentBackward" }));
	editor.dispatchEvent(new Event("change", { bubbles: true }));
}

function generateDeviceId() {
	if (crypto?.randomUUID) return crypto.randomUUID();
	return `dev-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getStorage() {
	if (typeof chrome !== "undefined" && chrome?.storage?.local) return chrome.storage.local;
	return {
		async get(key) {
			const raw = localStorage.getItem(key);
			return raw ? { [key]: JSON.parse(raw) } : {};
		},
		async set(obj) {
			Object.entries(obj || {}).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
		}
	};
}

async function getDeviceId() {
	const storage = getStorage();
	const stored = await storage.get(STORAGE_DEVICE);
	if (stored?.[STORAGE_DEVICE]) return stored[STORAGE_DEVICE];
	const id = generateDeviceId();
	await storage.set({ [STORAGE_DEVICE]: id });
	return id;
}

async function activateRemote(payload) {
	const fullPayload = { ...payload, notes: "ECWW", source: "ECWW" };
	const res = await fetch(`${API_BASE}/api/license/activate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(fullPayload)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
	return body;
}

async function ensureLicenseActive() {
	const deviceId = await getDeviceId();
	const storage = getStorage();
	const stored = await storage.get(STORAGE_ACTIVATION);
	const activation = stored?.[STORAGE_ACTIVATION];

	if (activation?.license_key && activation?.email) {
		const payload = await activateRemote({ license_key: activation.license_key, email: activation.email, device_id: deviceId });
		await storage.set({
			[STORAGE_ACTIVATION]: { ...activation, device_id: deviceId, status: payload.status, expires_at: payload.expires_at || null }
		});
		return { licenseKey: activation.license_key, deviceId };
	}

	const licenseKey = prompt("Informe sua license key HERO.IA");
	if (!licenseKey) {
		const err = new Error("Licença não informada.");
		err.code = "LICENSE_CANCELLED";
		throw err;
	}
	const email = prompt("Informe o e-mail vinculado à licença");
	if (!email) {
		const err = new Error("E-mail é obrigatório para ativar a licença.");
		err.code = "LICENSE_CANCELLED";
		throw err;
	}

	const payload = await activateRemote({ license_key: licenseKey.trim(), email: email.trim(), device_id: deviceId });
	await storage.set({
		[STORAGE_ACTIVATION]: {
			license_key: licenseKey.trim(),
			email: email.trim(),
			device_id: deviceId,
			status: payload.status,
			expires_at: payload.expires_at || null
		}
	});
	return { licenseKey: licenseKey.trim(), deviceId };
}

async function callBackend(path, payload) {
	const { licenseKey, deviceId } = await ensureLicenseActive();
	const res = await fetch(`${API_BASE}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-license-key": licenseKey,
			"x-device-id": deviceId
		},
		body: JSON.stringify(payload),
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body.error || `API error ${res.status}`);
	return body;
}

function createPanel() {
	if (document.getElementById(PANEL_ID)) return;
	const panel = document.createElement("div");
	panel.id = PANEL_ID;
	panel.innerHTML = `
		<button class="dismiss" aria-label="Fechar" title="Fechar">✕</button>
		<h3>🧠 HERO.IA Análise</h3>
		<p id="heroia-analysis-text"></p>
	`;
	panel.querySelector(".dismiss").onclick = () => { panel.style.display = "none"; };
	document.body.appendChild(panel);
}

function showPanel(text, variant = "copilot") {
	const panel = document.getElementById(PANEL_ID);
	const p = document.getElementById("heroia-analysis-text");
	const h3 = panel?.querySelector("h3");
	if (!panel || !p) return;
	panel.classList.toggle("heroia-panel-rewrite", variant === "rewrite");
	if (h3) h3.textContent = variant === "rewrite" ? "🧠 HERO.IA Insights" : "🧠 HERO.IA Análise";
	const suffix = variant === "rewrite" ? "" : "\n\n✍️ FollowUp sugerido GERADO 👉";
	const body = text ? `${text}${suffix}` : "";
	p.textContent = body;
	panel.style.display = text ? "block" : "none";
}

function setLoading(mode, isLoading) {
	state[mode] = isLoading;
}

async function handleDraftClick() {
	if (state.loadingDraft) return;
	setLoading("loadingDraft", true);
	try {
		createPanel();
		const composerText = getComposerText();

		if (composerText) {
			const fullySelected = isComposerFullySelected(composerText);
			if (fullySelected) {
				clearComposer();
			}

			const res = await callBackend("/whatsapp/refine", {
                 mensagem: composerText
            });

            const refined = res.refined?.trim() || composerText;

            if (refined) {
                clearComposer();
				insertTextInComposer(refined, { append: false });
				showPanel("Texto refinado. Insights:\n\n" + buildRewriteInsights(refined), "rewrite");
             } else {
                   alert("Não foi possível refinar o texto.");
          }


		}
	
		const inbound = extractInboundMessages(3);
		if (!inbound.length) {
			alert("Não encontrei mensagens do cliente. Role o chat e tente de novo.");
			return;
		}
		const res = await callBackend("/whatsapp/draft", { mensagens: inbound });
		const draft = res?.draft?.trim();
		if (draft) {
			const visual = sanitizeComposerVisual(draft);
			navigator.clipboard?.writeText(visual).catch(() => {});
			insertTextInComposer(visual);
		} else {
			alert("Backend não retornou rascunho.");
		}
	} catch (err) {
		console.error("HERO.IA draft error", err);
		if (err?.code === "LICENSE_CANCELLED" || err?.message === "Licença não informada.") return;
		alert(err?.message || "Erro ao gerar rascunho.");
	} finally {
		setLoading("loadingDraft", false);
	}
}

async function handleCopilotClick() {
	if (state.loadingCopilot) return;
	setLoading("loadingCopilot", true);
	try {
		createPanel();
		const messages = collectCopilotMessages(16);
		if (!messages.length) {
			alert("Não encontrei mensagens da conversa.");
			return;
		}
		const res = await callBackend("/whatsapp/copilot", { messages });
		const analysis = res?.analysis?.trim() || "";
		const suggestion = res?.suggestion?.trim() || res?.draft?.trim();
		showPanel(analysis);
		if (suggestion) {
			navigator.clipboard?.writeText(suggestion).catch(() => {});
			insertTextInComposer(suggestion);
		} else {
			alert("Backend não retornou sugestão.");
		}
	} catch (err) {
		console.error("HERO.IA copiloto error", err);
		if (err?.code === "LICENSE_CANCELLED" || err?.message === "Licença não informada.") return;
		alert(err?.message || "Erro ao rodar Copiloto.");
	} finally {
		setLoading("loadingCopilot", false);
	}
}

export const runCoreDraft = handleDraftClick;
export const runCoreFollowUp = handleCopilotClick;
export {
	getComposerText,
	clearComposer,
	insertTextInComposer,
	buildRewriteInsights,
	showPanel,
	callBackend,
	createPanel
};
