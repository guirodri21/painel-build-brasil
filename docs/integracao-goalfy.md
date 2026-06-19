# Integração Painel Build ↔ Goalfy

A integração reaproveita a infraestrutura de Integrações já existente:
- **Saída** (Painel → Goalfy): webhooks de saída (`dispatch` na Edge Function `integracoes`).
- **Entrada** (Goalfy → Painel): API de entrada (Edge Function `ingest`).

Nenhum código novo é necessário — apenas configuração. Este documento descreve o passo a passo e o **de-para** de campos.

---

## 1. Painel → Goalfy (enviar ordens/metas)

Quando uma ordem ou meta é criada/atualizada, o painel faz um `POST` para a URL cadastrada.

**Configurar:**
1. No painel, vá em **Integrações → Nova integração → Webhook de saída**.
2. Cole a URL de entrada do Goalfy, ex.:
   `https://api.goalfy.com.br/api/webhooks/<seu-id>`
3. Marque os eventos desejados: `ordem.criada`, `ordem.atualizada`, `meta.criada`, `meta.atualizada`, `estoque.baixo`.

**Formato enviado pelo painel:**
```json
{
  "evento": "ordem.criada",
  "enviado_em": "2026-06-19T12:00:00.000Z",
  "dados": {
    "data": "2026-06-19",
    "regiao": "...",
    "equipe": "...",
    "linha_servico": "...",
    "cliente": "...",
    "valor_venda": 1500,
    "despesa_direta": 200,
    "status": "em_andamento"
  }
}
```
> No Goalfy, mapeie os campos a partir de `dados.*`. Se o Goalfy exigir os campos na raiz, ajuste o `montarMensagem`/payload na Edge Function `integracoes`.

---

## 2. Goalfy → Painel (importar ordens)

O Goalfy precisa **fazer uma requisição HTTP de saída** (automação/webhook OUT) para a API de entrada do painel.

**Configurar:**
1. No painel, vá em **Integrações → Nova integração → API de entrada**. Isso gera um **token** (`secret`).
2. No Goalfy, crie uma **automação** que, ao criar/atualizar um registro, faça:
   - **Método:** `POST`
   - **URL:** `https://acezmxkbqzdwwdsoaqnu.supabase.co/functions/v1/ingest`
   - **Header:** `x-api-key: <token do passo 1>`
   - **Corpo (JSON):** um objeto, uma lista, ou `{ "ordens": [...] }`

**De-para de campos esperado pelo `ingest`:**

| Campo no Painel  | Obrigatório | Observação                                   |
|------------------|-------------|----------------------------------------------|
| `data`           | ✅          | data da ordem (YYYY-MM-DD)                    |
| `regiao`         | ✅          | precisa existir em Cadastros → Regiões        |
| `equipe`         | ✅          | precisa existir em Cadastros → Equipes        |
| `linha_servico`  | ✅          | aceita `linha` como alias                     |
| `cliente`        | —           |                                              |
| `valor_venda`    | —           | número                                        |
| `despesa_direta` | —           | número                                        |
| `status`         | —           | `em_andamento` / `execucao_parcial` / `concluido` |
| `tempo_execucao_h` | —         | número                                        |
| `qualidade`      | —           | 0–100                                         |
| `resumo`         | —           | texto                                         |

**Resposta de sucesso:** `201` com `{ "ok": true, "criadas": N, "ids": [...] }`.

> ⚠️ `regiao`, `equipe` e `linha_servico` têm FK para as tabelas de cadastro — valores inexistentes são rejeitados (HTTP 422). Cadastre-os antes, ou ajuste o `ingest` para criá-los on-the-fly.

---

## 3. Goalfy → Painel (board de Chamados) ⭐ recomendado

Espelha os cards do board do Goalfy no módulo **Chamados** do painel (mesmas 9 fases),
via a Edge Function `chamados-ingest` (upsert pelo id do card — mover de fase atualiza o
mesmo chamado, sem duplicar).

**Configurar no painel:**
1. **Integrações → Nova → API de entrada** → copie o **token** gerado.

**Configurar no Goalfy (automação):**
1. **Acionador (gatilho):** use **"Quando um card é criado"** e **"Quando um card é movido para uma fase"** (uma automação para cada, ou um fluxo com os dois).
2. **Ação:** **"Requisição HTTP"** com:
   - **Método:** `POST`
   - **URL:** `https://acezmxkbqzdwwdsoaqnu.supabase.co/functions/v1/chamados-ingest`
   - **Header:** `x-api-key: <token do passo 1>`
   - **Body (JSON):** mapeie as variáveis do card do Goalfy:

```json
{
  "card_id":     "{{id do card}}",
  "titulo":      "{{título da demanda}}",
  "cliente":     "{{cliente/solicitante}}",
  "regiao":      "{{região}}",
  "descricao":   "{{descrição}}",
  "prioridade":  "{{prioridade}}",
  "ticket_ref":  "{{ticket trilogo}}",
  "fase":        "{{nome da fase atual}}",
  "valor":       0,
  "responsavel": "{{responsável}}"
}
```

**Regras importantes:**
- `card_id` é a **chave de idempotência** — garante que mover/atualizar o card no Goalfy
  **atualiza** o mesmo chamado no painel (não cria duplicado).
- `fase` deve ser **exatamente** o nome da coluna (Triagem, Em Orçamento, Proposta Enviada,
  Planejamento, Em Execução, Resolvido / Análise, Fechamento Financeiro, A Faturar, Concluído).
  As fases ficam em `chamado_fases` (editáveis pelo admin).
- `valor` é opcional — preencha com o campo financeiro do card (se houver) para alimentar os KPIs.

**Resposta de sucesso:** `201` com `{ "ok": true, "sincronizados": N }`.

> Para a **carga inicial** dos 695 cards, use uma automação/ação em massa no Goalfy que
> dispare a Requisição HTTP para cada card existente (ou rode o gatilho "card movido" uma vez).

## Onde o código vive
- Saída/WhatsApp/dispatch: [`supabase/functions/integracoes/index.ts`](../supabase/functions/integracoes/index.ts)
- Entrada (ordens): [`supabase/functions/ingest/index.ts`](../supabase/functions/ingest/index.ts)
- Entrada (chamados/board): [`supabase/functions/chamados-ingest/index.ts`](../supabase/functions/chamados-ingest/index.ts)
- Board de chamados (front): [`web/src/app/(app)/chamados/page.tsx`](../web/src/app/(app)/chamados/page.tsx)
- Eventos e helpers no front: [`web/src/lib/integrations.ts`](../web/src/lib/integrations.ts)
