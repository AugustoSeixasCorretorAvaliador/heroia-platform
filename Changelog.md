# Changelog — HEROIA Platform

Todas as mudanças relevantes do projeto serão documentadas aqui.

O versionamento segue o padrão:
**MAJOR.MINOR.PATCH**

---

## [1.0.0] — 2026-02-17
### 🎉 Initial Unified Release

Primeira versão estável da **HEROIA Platform** como extensão unificada.

### Added
- Unificação de múltiplas extensões em uma única plataforma
- Arquitetura modular (`modules/` e `services/`)
- Toolbar única integrada ao WhatsApp Web
- MutationObserver único e idempotente
- Inserção de rascunhos sem envio automático
- Módulos funcionais:
  - Core (Gerar Rascunho + Copiloto/Follow-up)
  - Enviar PDF
  - Transcrever Áudio
  - Simular Crédito (SAC/PRICE, FGTS, ajuste 30%)
- `.gitignore` seguro
- Documentação inicial:
  - README
  - ARCHITECTURE
  - ROADMAP
  - SECURITY

### Security
- Nenhuma credencial versionada
- Nenhum endpoint sensível exposto
- Namespace DOM/CSS protegido

---

## [Unreleased]
### Planned
- Feature flags por módulo
- Tela de configuração
- Logs estruturados
- Modo de segurança (safe mode)
- Documentação visual da arquitetura

---

## Convenções

- **Added**: novas funcionalidades
- **Changed**: alterações de comportamento
- **Fixed**: correções
- **Security**: ajustes de segurança
- **Removed**: funcionalidades removidas

---

📌 Nota:
Este projeto prioriza **governança da decisão com IA**, não automação autônoma.
