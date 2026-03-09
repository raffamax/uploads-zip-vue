# Projeto exemplo: Vue + API Node + Supabase Storage

## Estrutura

- `front-vue`: aplicação Vue 3 + Vite que recebe múltiplos arquivos, gera um `.zip` no navegador e envia para a API.
- `api-node`: API Express que recebe o `.zip` e salva no Supabase Storage.

## Como rodar localmente

### 1. Front

```bash
cd front-vue
npm install
cp .env.example .env
npm run dev
```

### 2. API

```bash
cd api-node
npm install
cp .env.example .env
npm run dev
```

## Variáveis do front

```env
VITE_API_URL=http://localhost:3001
```

## Variáveis da API

```env
PORT=3001
CORS_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxx
SUPABASE_STORAGE_BUCKET=uploads
```

## Fluxo

1. O usuário seleciona vários arquivos no front.
2. O Vue gera um `.zip` sem compressão com JSZip.
3. O front envia o `.zip` em `multipart/form-data` para `POST /upload`.
4. A API recebe o arquivo e envia para o bucket do Supabase Storage.
