# Roadmap — HEROIA Platform

## v1.0 (agora — base unificada)
- [x] Unificação em uma extensão (MV3)
- [x] Toolbar única + observer único
- [x] Inserção de rascunho sem auto-send
- [x] Módulos: PDF, Áudio, Crédito funcionando
- [x] .gitignore seguro

## v1.1 (estabilização)
- [ ] Auditoria de segredos (garantir que não há tokens/chaves no repo)
- [ ] Padronização de logs (console) com níveis (info/warn/error)
- [ ] Tratamento resiliente de DOM (âncoras alternativas no WhatsApp)
- [ ] Debounce/Throttle do observer com métricas simples (contagem de triggers)

## v1.2 (governança e produto)
- [ ] Feature flags por módulo (enable/disable)
- [ ] Tela de Configuração (ex: opções, chaves, preferências)
- [ ] Versão e changelog
- [ ] “Safe mode” (desliga módulos se detectar inconsistência de DOM)

## v1.3 (entrega e operação)
- [ ] Build pipeline (opcional): empacotamento para distribuição interna
- [ ] Guia de instalação para usuários (PDF/landing)
- [ ] Instrumentação local (sem PII): eventos por botão e tempo de resposta

## v2.0 (escala)
- [ ] Sistema de licenças modular (se aplicável)
- [ ] Mecanismo de updates (estratégia: store / distribuição privada)
- [ ] Modelo white-label (se estratégia comercial exigir)

---

### Referências técnicas
- MV3: https://developer.chrome.com/docs/extensions/mv3/
- Empacotamento/extensão: https://developer.chrome.com/docs/extensions/mv3/manifest/
