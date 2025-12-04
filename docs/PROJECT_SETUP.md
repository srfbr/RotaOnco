# RotaOnco — Guia de Preparação do Ambiente

> **Objetivo:** orientar alguém que acabou de clonar o repositório a colocar o projeto em funcionamento (API, Web e Mobile) e listar os comandos úteis do monorepo.

## 1. Pré-requisitos

- **Bun** 1.2.x (inclui TypeScript, vite, etc.)
- **Node.js** 18+ (apenas para tooling eventual)
- **Git**
- **Docker** e **Docker Compose** (para subir MySQL local)
- **Expo CLI** (para rodar o app mobile) — instale com `npm install -g expo-cli` se ainda não tiver

> Se estiver em Windows, recomenda-se usar WSL2 ou configurar Docker Desktop.

## 2. Clonar e instalar dependências

```sh
git clone https://github.com/srfbr/RotaOnco.git
cd RotaOnco
bun install
```

O `bun install` resolve todas as workspaces (API, web, mobile, libs compartilhadas).

## 3. Variáveis de ambiente

Cada app tem seu próprio `.env`. As referências principais estão em `apps/server/.env.example` e `apps/native/.env.example`. Execute:

```sh
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
cp apps/native/.env.example apps/native/.env
```

* Ajuste os valores conforme seu ambiente.
* **SERVER**: configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, domínios de origem etc.
* **WEB**: browsers usam o endereço local da API (`VITE_API_URL=http://localhost:3000/api`).
* **NATIVE**: app mobile precisa saber os endpoints (`EXPO_PUBLIC_API_URL` etc.).

## 4. Banco de dados local

1. Suba o MySQL com Docker:
   ```sh
   cd apps/server
   bun run db:start   # docker compose up -d
   ```

2. Execute as migrações:
   ```sh
   bun run db:migrate
   ```

3. (Opcional) Seed de dados iniciais:
   ```sh
   bun run db:seed
   ```

## 5. Rodando os projetos

### API (Hono + Bun)

```sh
cd apps/server
bun run dev
```

Servirá em `http://localhost:3000`. Documentação OpenAPI em `http://localhost:3000/openapi`.

### Web (Vite + TanStack Router)

```sh
cd apps/web
bun run dev
```

Interface em `http://localhost:3001` (ou porta reportada no terminal). Certifique-se de que `VITE_API_URL` aponta para `http://localhost:3000/api`.

### Mobile (Expo)

```sh
cd apps/native
bun run dev   # ou `npx expo start`
```

Abra o app Expo Go no dispositivo físico ou emulador. Configure `EXPO_PUBLIC_API_URL` para a URL acessível da API (use IP da máquina, não `localhost`, em dispositivos físicos).

## 6. Comandos úteis do monorepo

### Primo nível (`package.json` na raiz)

- `bun run dev` — roda `turbo dev` com API, Web e Native em paralelo.
- `bun run build` — build de todas as workspaces (CI/CD).
- `bun run db:migrate` — reencaminha para o script de migração do servidor.

### Apps/Server

- `bun run dev` — API em modo hot reload.
- `bun run test` — testes unitários/integrados (Vitest).
- `bun run db:migrate` — aplica migrações (Drizzle).
- `bun run db:generate` — gera arquivos SQL a partir do schema.
- `bun run db:seed` — sementes de banco.
- `bun run db:start` / `db:stop` / `db:watch` — gerencia o Docker Compose com MySQL.
- `bun run compile` — gera build standalone bun.

### Apps/Web

- `bun run dev` — Vite em modo desenvolvimento.
- `bun run build` — build estático (produção).
- `bun run preview` — pré-visualiza o build.

### Apps/Native

- `bun run dev` — Expo dev server.
- `bun run build:android` / `build:ios` (se configurados) — cria binários.

### Scripts auxiliares (server)

Na pasta `apps/server/scripts` há utilitários em Bun para administração:

- `grant-role.ts` — ajustar papéis de usuários.
- `set-password.ts`, `hash-password.ts` — manipulação de credenciais.
- Scripts `inspect-*` — diagnosticar contas e providers do Better Auth.

Execute com `bun run scripts/<nome>.ts`.

## 7. Fluxo de contribuição

1. Crie branch a partir de `main`.
2. Faça alterações + testes (`bun run test` onde aplicável).
3. Atualize documentação se necessário (`docs/`).
4. Abra PR seguindo convenções do repositório.

## 8. Dicas

- Quando atualizar rotas da Web, rode `bun run vite-routes` (ou o script documentado no README) se necessário.
- Lembre-se de definir `APP_WEB_URL` e `PASSWORD_RESET_TOKEN_TTL_MINUTES` para o fluxo de recuperação de senha.
- Para troubleshooting, `turbo` registra logs em `.turbo/` dentro de cada workspace.

---

Com isso o projeto deve ficar pronto para desenvolvimento local. Se surgir alguma inconsistência, verifique `README.md` e os documentos em `docs/` para contexto adicional.
