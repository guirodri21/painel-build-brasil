#!/usr/bin/env bash
# ============================================================
# Build Brasil — Proteção Vercel (Firewall / WAF)
#
# Filosofia (recomendada pelo próprio Vercel): NADA bloqueia de cara.
# Tudo entra em modo "log" → você revisa o tráfego no painel → só então
# vira "deny"/"rate_limit". Cada passo é um DRAFT; você publica quando quiser.
#
# Rodar os comandos UM A UM, lendo a saída. Não é pra sair executando tudo.
# ============================================================

# ---------- PRÉ-REQUISITOS (uma vez) ----------
#   npm i -g vercel          # instala o CLI
#   vercel login             # entra na sua conta
#   vercel link              # dentro do repo; selecione o projeto do painel
#
# Confira que linkou o projeto certo:
#   cat .vercel/project.json


# ---------- 0. Panorama atual ----------
vercel firewall overview
# DDoS já está ativo e grátis em todos os planos — não precisa configurar nada.


# ============================================================
# FASE 1 — CRIAR AS REGRAS EM MODO "LOG" (não bloqueia ninguém)
# ============================================================

# 1) Bloquear varreduras de exploit (WordPress, .env, .git, phpMyAdmin...)
vercel firewall rules add "Probes de exploit" \
  --condition '{"type":"path","op":"inc","value":["/wp-admin","/wp-login.php","/.env","/.git/config","/phpmyadmin","/xmlrpc.php"]}' \
  --action log --yes

# 2) Rate limit nas páginas públicas (login, assinar, formulários /f/)
#    60 req/min por IP — generoso; só LOGA por enquanto.
vercel firewall rules add "Rate limit publico" \
  --condition '{"type":"path","op":"inc","value":["/login","/assinar"]}' \
  --or --condition '{"type":"path","op":"pre","value":"/f/"}' \
  --action rate_limit \
  --rate-limit-window 60 --rate-limit-requests 60 --rate-limit-keys ip \
  --rate-limit-action log --yes

# 3) (Opcional) Rate limit global anti-flood — bem folgado (600 req/min por IP).
#    Pega ataque amplo sem incomodar uso normal. Também só LOGA.
vercel firewall rules add "Flood global" \
  --condition '{"type":"path","op":"pre","value":"/"}' \
  --action rate_limit \
  --rate-limit-window 60 --rate-limit-requests 600 --rate-limit-keys ip \
  --rate-limit-action log --yes

# Publicar os drafts (colocar as regras — em modo log — no ar):
vercel firewall diff          # revisa o que vai mudar
vercel firewall publish --yes


# ============================================================
# FASE 2 — REVISAR (deixe rodando ~1 a 3 dias)
# ============================================================
# No painel: Projeto → Firewall → Traffic, filtre por cada regra e confira
# que só está pegando abuso (nada de usuário real / crawler bom / seu CI).
#   vercel firewall rules list --json   # pega os IDs (rule_...)
# URL: https://vercel.com/<time>/<projeto>/firewall/traffic?filter=<ruleId>


# ============================================================
# FASE 3 — PASSAR A BLOQUEAR (só depois de revisar!)
# ============================================================
# (Editar sem passar --condition preserva as condições; muda só a ação.)

# 1) Probes de exploit → bloquear (403)
vercel firewall rules edit "Probes de exploit" --action deny --yes

# 2) Rate limit público → passar a limitar de fato (429 ao estourar)
vercel firewall rules edit "Rate limit publico" --rate-limit-action rate_limit --yes

# 3) Flood global → limitar de fato
vercel firewall rules edit "Flood global" --rate-limit-action rate_limit --yes

vercel firewall publish --yes


# ============================================================
# EXTRAS (painel — não tem no CLI de rules)
# ============================================================
# • Bot Protection (managed ruleset): Projeto → Firewall → Managed Rules.
#   Desafia bots ruins nas páginas. (Pode exigir plano Pro.)
#
# • Attack Challenge Mode ("botão de pânico" durante ataque):
#   Projeto → Firewall → Attack Challenge Mode (ativa por 1h/6h/24h).
#   Também via CLI, mas exige confirmação interativa:
#     vercel firewall attack-mode enable --duration 1h
#
# • IP abusivo pontual:
#     vercel firewall ip-blocks block 1.2.3.4 --notes "abuso" --yes
#     vercel firewall publish --yes
#
# • Liberar IP confiável de TODAS as checagens (ex.: seu escritório):
#     vercel firewall system-bypass add SEU.IP.AQUI --notes "escritorio" --yes
# ============================================================
