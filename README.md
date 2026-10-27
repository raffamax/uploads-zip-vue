# Projeto exemplo: Vue + Supabase Storage

## Estrutura

- `front-vue`: aplicação Vue 3 + Vite que recebe múltiplos arquivos, gera um `.zip` no navegador e envia diretamente para o Supabase Storage.
- `api-node`: implementação antiga, não necessária para executar o frontend.

## Como rodar localmente

### 1. Front

```bash
cd front-vue
npm install
cp .env.example .env
npm run dev
```

## Variáveis do front

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_SUPABASE_STORAGE_BUCKET=uploads
```

Use somente a chave pública `anon` no frontend. Nunca coloque `SUPABASE_SECRET_KEY` em variáveis `VITE_*`.

## Fluxo

1. O usuário seleciona vários arquivos no front.
2. O Vue gera um `.zip` sem compressão com JSZip.
3. O front envia o `.zip` diretamente para o bucket do Supabase Storage.
4. O front lista, gera URLs temporárias e exclui arquivos usando o Supabase JS.

## Autenticação e isolamento dos arquivos

O frontend usa Supabase Auth para cadastro e login. Cada ZIP é salvo em uma pasta com o ID do usuário:

```text
<user.id>/<ano>/<mês>/<arquivo>.zip
```

Para que o isolamento também seja aplicado no Storage (e não apenas na interface), crie estas políticas no SQL Editor do Supabase. Substitua `uploads` pelo nome do seu bucket, se necessário:

```sql
create policy "Usuários podem listar seus próprios arquivos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Usuários podem enviar seus próprios arquivos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Usuários podem excluir seus próprios arquivos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'uploads'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
```

Se a confirmação de e-mail estiver habilitada no Supabase Auth, o usuário precisará confirmar o e-mail antes de conseguir entrar.
