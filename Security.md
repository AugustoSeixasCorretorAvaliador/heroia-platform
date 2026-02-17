# Security Policy — HEROIA Platform

Este documento descreve as diretrizes de segurança do projeto **HEROIA Platform**.

A plataforma opera como **Chrome Extension (Manifest V3)** integrada ao WhatsApp Web e, por definição, lida com **dados sensíveis de conversas comerciais**. Portanto, segurança **não é opcional**.

---

## 🔐 Princípios de Segurança

1. **Nenhuma automação de envio**
   - A extensão **nunca envia mensagens automaticamente**.
   - Toda ação termina em inserção de rascunho no input.
   - A decisão final é sempre humana.

2. **Nenhum segredo versionado**
   - Nunca versionar:
     - API keys (OpenAI, Supabase, etc.)
     - Tokens
     - `.env`
     - Credenciais
   - O repositório deve permanecer livre de qualquer segredo.

3. **Isolamento de contexto**
   - A extensão roda apenas como *content script* no domínio `web.whatsapp.com`.
   - Não intercepta tráfego de rede.
   - Não coleta dados fora do escopo da conversa ativa.

4. **Namespace protegido**
   - Todo DOM e CSS injetado é prefixado com `hero-`.
   - Evita colisões e ataques por sobrescrita de seletor.

5. **Observação controlada de DOM**
   - Apenas **um MutationObserver** é permitido.
   - Nenhum `setInterval` para inspeção contínua.
   - Reduz risco de loops, leaks e degradação de performance.

---

## 🚫 O que é explicitamente proibido

- Subir qualquer string contendo:
  - `sk-`
  - `Bearer `
  - JWTs
  - Tokens fixos
- Logar conteúdo sensível da conversa em serviços externos.
- Injetar scripts remotos.
- Executar código recebido da conversa (eval, Function, etc.).

---

## 🧪 Checklist de Segurança antes de cada release

Antes de marcar uma versão:

- [ ] Rodar busca por `sk-` no repositório
- [ ] Verificar `.gitignore`
- [ ] Confirmar ausência de `.env` versionado
- [ ] Revisar logs de console
- [ ] Validar que não há auto-send
- [ ] Confirmar escopo restrito a `web.whatsapp.com`

---

## 📢 Reporte de vulnerabilidades

Caso encontre uma vulnerabilidade:

- **Não abra issue pública**
- Reporte diretamente ao mantenedor do projeto

Resposta será priorizada.

---

## 📚 Referências

- OWASP Application Security Verification Standard (ASVS)  
  https://owasp.org/www-project-application-security-verification-standard/
- Chrome Extension Security  
  https://developer.chrome.com/docs/extensions/mv3/security/
- GitHub Security Best Practices  
  https://docs.github.com/en/code-security
