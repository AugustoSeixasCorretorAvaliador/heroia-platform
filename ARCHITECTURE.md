# Arquitetura — HEROIA Platform

## Objetivo de arquitetura
Unificar múltiplas funcionalidades em **uma única extensão** mantendo:

- **CORE preservado** (Gerar Rascunho + Copiloto/Follow-up)
- **Módulos isolados** (PDF, Áudio, Crédito)
- **Uma única UI** (toolbar)
- **Um único observador** (MutationObserver)
- **Nenhuma automação de envio**

## Diagrama mental (alto nível)

WhatsApp Web DOM
  ↑
content.js (entrypoint)
  ├─ services/observer.js  → 1 MutationObserver
  ├─ services/toolbar.js   → 1 toolbar (idempotente)
  ├─ services/waDom.js     → leitura DOM (mensagens, âncoras, input)
  ├─ services/textInsert.js→ inserir rascunho sem enviar
  └─ modules/*
      ├─ core.js           → ações do core (sem refatorar algoritmo)
      ├─ pdf.js            → geração/link/entrega em rascunho
      ├─ audio.js          → transcrição + rascunho (mantém fluxo de chave)
      └─ credito.js        → simulação (SAC/PRICE, FGTS, ajuste 30%)

## Regras de ouro (não negociáveis)
1. **Somente um MutationObserver**  
   - evita duplicação de eventos e competição por DOM.

2. **Somente a toolbar injeta UI**  
   - módulos não criam botões, não mexem em layout.

3. **Idempotência**  
   - `ensureToolbar()` e `ensureObserver()` devem retornar sem efeito se já instalados.

4. **Sem envio automático**  
   - qualquer ação termina em *inserir rascunho no input*.

5. **Prefixo de namespace**  
   - IDs e classes devem começar com `hero-`.

## Responsabilidades por arquivo

### content.js
- Entry point
- Inicializa observer e toolbar
- Conecta cliques da UI aos módulos

### services/observer.js
- Cria o MutationObserver único
- Detecta mudanças no DOM do WhatsApp
- Dispara `toolbar.ensureToolbar()` em momentos corretos (com debounce)

### services/toolbar.js
- Localiza âncora de inserção (ex: container do core / “Gerar rascunho”)
- Injeta botões adicionais (PDF, Áudio, Crédito)
- Garante idempotência e não quebra layout

### services/waDom.js
- Funções de acesso ao DOM do WhatsApp:
  - capturar texto de conversa
  - encontrar input contenteditable
  - encontrar âncoras confiáveis

### services/textInsert.js
- Inserção no campo de mensagem sem enviar
- Preferência por InputEvent moderno; fallback controlado se necessário

### modules/*.js
- Implementam lógica de negócio
- Retornam string(s) a inserir ou executam fluxos controlados
- Não injetam UI

## Estratégia de evolução
- Novos módulos entram como `modules/<nome>.js` + um botão na toolbar.
- Feature flags (futuro): habilitar/desabilitar módulos sem alterar core.
- Observabilidade (futuro): analytics local + export para logs (sem coletar PII).

---

### Referências técnicas
- MV3: https://developer.chrome.com/docs/extensions/mv3/
- Content scripts e isolamento: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/
- MutationObserver: https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
