# HEROIA Platform (Chrome Extension)

HEROIA Platform é uma extensão Chrome (Manifest V3) que opera **dentro do WhatsApp Web** como um **copiloto assistivo** para atendimento comercial, sempre com **controle humano total**: a extensão **gera rascunhos** e **insere textos no campo de mensagem**, mas **não envia automaticamente**.

## O que está unificado aqui

Uma única extensão com 5 ações principais no WhatsApp Web:

1. **Gerar Rascunho** (core)
2. **Copiloto / Follow-up** (core)
3. **Enviar PDF** (módulo)
4. **Transcrever Áudio** (módulo)
5. **Simular Crédito** (módulo)

> Observação: a plataforma é modular por design. Cada capacidade é um módulo isolado, orquestrado por um único content script e uma única toolbar.

## Princípios de segurança e operação

- **Sem agente autônomo**: nada é enviado automaticamente.
- **Idempotência**: UI e observers são injetados apenas uma vez.
- **Um único MutationObserver**: evita corrida, duplicação e “sumir botão”.
- **Namespace CSS/DOM prefixado**: evita colisão com WhatsApp.
- **Credenciais não versionadas**: `.env` e segredos não entram no Git.

## Estrutura do projeto

icons/
modules/
core.js
pdf.js
audio.js
credito.js
services/
observer.js
toolbar.js
waDom.js
textInsert.js
background.js
content.js
manifest.json
style.css

## Como instalar (modo desenvolvedor)

1. Abra `chrome://extensions`
2. Ative **Developer mode**
3. Clique em **Load unpacked**
4. Selecione a pasta do projeto (onde está o `manifest.json`)
5. Abra `https://web.whatsapp.com/` e teste os botões

## Como contribuir (padrão mínimo)

- Não introduzir `setInterval` para observar DOM.
- UI só em `services/toolbar.js`.
- Observação DOM só em `services/observer.js`.
- Módulos não injetam UI (apenas funções chamadas pela toolbar).
- Nunca enviar mensagens automaticamente (apenas inserir rascunho).

## Licença

Definir.

---

### Referências técnicas
- Manifest V3 (Chrome Extensions): https://developer.chrome.com/docs/extensions/mv3/
- Content Scripts: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/
- MutationObserver (MDN): https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
