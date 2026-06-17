# Build Brasil — Painel de Resultados

Painel interno para gestão de vendas, operações e financeiro.
Stack: HTML/CSS/JS puro + Supabase (banco + auth) + hospedagem estática gratuita.

---

## Passo a passo de setup

### 1. [VOCÊ FAZ] Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (plano free).
2. Clique em **New Project**. Escolha um nome (ex.: `build-brasil`) e uma senha para o banco.
3. Aguarde o projeto ser provisionado (~2 min).

### 2. [VOCÊ FAZ] Rodar o schema no banco

1. No painel do Supabase, vá em **SQL Editor**.
2. Clique em **New Query**.
3. Cole o conteúdo inteiro do arquivo `supabase/schema.sql` e clique **Run**.
4. Deve aparecer "Success" — as tabelas, políticas RLS e dados de exemplo foram criados.

### 3. [VOCÊ FAZ] Copiar credenciais para config.js

1. No Supabase, vá em **Settings → API**.
2. Copie a **Project URL** (ex.: `https://abc123.supabase.co`).
3. Copie a **anon (public) key**.
4. Abra o arquivo `config.js` e substitua os valores de `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

> **Nunca** use a `service_role key` no frontend. A `anon key` é segura com RLS ativado.

### 4. [VOCÊ FAZ] Criar o primeiro usuário

1. No Supabase, vá em **Authentication → Users**.
2. Clique em **Add User → Create New User**.
3. Preencha e-mail e senha. Marque "Auto Confirm User".
4. Esse será o login para acessar o painel.

> **Restringir cadastro:** Para evitar que qualquer pessoa se registre, no Supabase vá em
> **Authentication → Providers → Email** e desabilite "Enable Sign Up". Assim, só administradores
> podem criar usuários pelo painel do Supabase. Alternativamente, crie uma trigger SQL que
> verifica o domínio do e-mail (ex.: `@buildbrasil.com.br`).

### 5. Testar localmente

Qualquer servidor HTTP estático funciona. Exemplos:

```bash
# Opção 1: npx
npx serve .

# Opção 2: Python
python -m http.server 8000

# Opção 3: VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

Abra o navegador, faça login com o usuário criado no passo 4.
O painel deve aparecer com os dados de exemplo (10 ordens + 6 despesas).

### 6. [VOCÊ FAZ] Publicar de graça

#### Opção A — Cloudflare Pages

1. Suba o projeto para um repositório no GitHub.
2. Em [dash.cloudflare.com](https://dash.cloudflare.com), vá em **Workers & Pages → Create → Pages**.
3. Conecte o repositório. Framework preset: **None**. Build command: deixe vazio. Output directory: `/`.
4. Deploy. O site estará em `https://seu-projeto.pages.dev`.

#### Opção B — Vercel

1. Suba o projeto para um repositório no GitHub.
2. Em [vercel.com](https://vercel.com), importe o repositório.
3. Framework: **Other**. Sem build command. Output directory: `/`.
4. Deploy. O site estará em `https://seu-projeto.vercel.app`.

---

## Estrutura de arquivos

```
index.html          Tela de login + app (página única)
app.js              Supabase client, auth, CRUD, filtros, cálculos, render
styles.css          Identidade visual (prancha de engenharia)
config.js           URL e anon key do Supabase
supabase/schema.sql Tabelas, RLS, dados de exemplo
README.md           Este arquivo
```

## Políticas RLS aplicadas

| Tabela           | SELECT | INSERT | UPDATE | DELETE |
|------------------|--------|--------|--------|--------|
| equipes          | Autenticado | — | — | — |
| regioes          | Autenticado | — | — | — |
| linhas_servico   | Autenticado | — | — | — |
| ordens           | Autenticado | Autenticado | Só criador | Só criador |
| despesas_gerais  | Autenticado | Autenticado | Só criador | Só criador |

## Regra de rateio financeiro

- **Despesa direta:** vai para a equipe da ordem.
- **Despesas gerais:** rateadas entre as equipes proporcionalmente à receita de cada uma.
- Essa regra está isolada na função `calcRateio()` em `app.js`. Validar com o financeiro antes de oficializar.
