# supabase/migrations

Esta pasta guarda as **migrações novas** do banco — alterações de schema que ainda
**não** foram aplicadas no Supabase. O GitHub Action
[`.github/workflows/supabase.yml`](../../.github/workflows/supabase.yml) roda
`supabase db push` a cada push no `main` e aplica, em ordem de timestamp, qualquer
migração desta pasta que ainda não esteja registrada no banco.

## Como criar uma migração nova

1. Crie um arquivo aqui com o nome no formato `AAAAMMDDHHMMSS_descricao.sql`
   (timestamp em UTC). O timestamp **precisa ser maior** que o da última migração já
   aplicada no banco (a mais recente é `20260626124958`). Use a data/hora atual — sempre
   será maior.

   Exemplo: `20260701093000_adiciona_coluna_telefone.sql`

2. Escreva o SQL da mudança. Prefira comandos idempotentes
   (`create table if not exists`, `add column if not exists`, etc.).

3. Faça commit e push no `main`. O Action aplica a migração no banco automaticamente.

## Histórico já aplicado (não fica aqui)

As ~45 migrações que construíram o banco até hoje **já estão aplicadas** e registradas
no próprio Supabase (`supabase_migrations.schema_migrations`). Por isso elas **não**
ficam nesta pasta — o `db push` as ignora (já aplicadas) e não as re-executa. O SQL
legível dessas mudanças continua em `supabase/*.sql` (ex.: `schema.sql`,
`migration-*.sql`) como referência.

## Seeds e resets

Arquivos de dados (`supabase/seed-*.sql`) e manutenção (`supabase/reset-*.sql`) **não**
são migrações — não devem ser colocados aqui. Continue rodando-os manualmente quando
necessário.
