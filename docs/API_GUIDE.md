# RotaOnco — Guia da API

## Visão Geral
A API do RotaOnco expõe recursos REST para os clientes Web (profissionais/administradores) e Mobile (pacientes e profissionais em campo). A especificação completa está em `apps/server/openapi.yaml`, que descreve os contratos, modelos e respostas. Este guia resume convenções, segurança e fornece exemplos práticos para os fluxos prioritários.

- Base URL local: `http://localhost:8787`
- Versão atual: `v0` (controlada via versionamento semântico pela rota base — alterações breaking exigem novo prefixo ou versão na OpenAPI)
- Formato padrão: JSON (`application/json`), exceto downloads de relatórios (`application/pdf` ou `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

## Autenticação e Sessões

| Público           | Mecanismo                     | Endpoints de Sessão                      | Observações |
|-------------------|--------------------------------|------------------------------------------|-------------|
| Profissionais \| Administradores | Bearer JWT (Better Auth)          | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` | Tokens de acesso + refresh; payload JWT inclui `roles`.
| Pacientes         | Cookie HttpOnly `patient_session` | `POST /auth/patient-pin`, `POST /auth/logout` | Sessão curta com bloqueio após 3 tentativas de PIN.

- Todos os endpoints (exceto `/auth/*`) exigem cabeçalho `Authorization: Bearer <token>` ou cookie `patient_session`, conforme o papel.
- Operações descrevem papéis aceitos via extensão `x-roles` na especificação.
- Para ambientes públicos, force HTTPS e cookies marcados com `Secure`/`SameSite=Strict`.

## RBAC (Papéis e Escopo)

| Recurso/Fluxo                     | Paciente | Profissional | Administrador |
|-----------------------------------|:--------:|:------------:|:-------------:|
| Consultar/atualizar próprio perfil (`GET /patients/me`, confirmações) | ✅ | — | — |
| Gestão de pacientes (`/patients`, contatos, histórico) | — | ✅ | ✅ |
| Gestão de profissionais (`/professionals`) | — | — | ✅ |
| Agenda/consultas (`/appointments`, confirmar/declinar) | ✅ (apenas confirmar/declinar) | ✅ | ✅ |
| Intercorrências (`/patients/{id}/occurrences`) | — | ✅ | ✅ (consulta) |
| Alertas (`/alerts`) | — | ✅ | ✅ |
| Relatórios (`/reports/*`) | — | ✅ | ✅ (exportação exclusiva) |
| Lembretes (`/notifications/appointment-reminders`) | — | — | ✅ |

O back-end deve validar o papel no middleware e negar por padrão. O front-end usa o mesmo mapeamento para ocultar ações não permitidas.

## Convenções

- **Paginação**: parâmetros `limit` (1-100, padrão 20) e `offset` (padrão 0). Respostas retornam objeto `{ data, meta }`, onde `meta = { total, limit, offset }`.
- **Filtro/Búsqueda**: query `q` para busca textual, `status`, `stage`, `day`, etc., conforme recurso.
- **Idempotência**: operações sensíveis (`POST /professionals`, `POST /patients`, `POST /appointments`) aceitam cabeçalho `Idempotency-Key`. Requisições repetidas com a mesma chave retornam o mesmo resultado e não criam duplicados.
- **Erros**: formato único `{ code: string, message: string, details?: object }`. Consulte a tabela na OpenAPI para códigos específicos (ex.: `VALIDATION_ERROR`, `UNIQUE_CONSTRAINT`, `RATE_LIMITED`).
- **Rate limiting**: endpoints de autenticação enviam cabeçalhos `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`. Aplicar limites distintos para login vs. operações gerais.
- **Auditoria**: operações que alteram dados persistem registro em `audit_logs` com usuário, ação, entidade e metadados; manter o contexto do request para IP/User-Agent.

## Exemplos de Fluxos

### Login de Profissional
```http
POST /auth/login HTTP/1.1
Host: localhost:8787
Content-Type: application/json

{
  "email": "ana.profissional@rotaonco.com",
  "password": "Senha@Forte123"
}
```
**200 OK**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "def50200...",
  "expiresIn": 3600,
  "user": {
    "id": 42,
    "name": "Ana Profissional",
    "email": "ana.profissional@rotaonco.com",
    "documentId": "12345678901",
    "roles": ["professional"],
    "isActive": true,
    "createdAt": "2025-10-08T12:00:00.000Z",
    "updatedAt": "2025-10-08T12:00:00.000Z"
  }
}
```
Falhas de autenticação retornam `401` com `{ "code": "INVALID_CREDENTIALS", "message": "Credenciais inválidas" }`.

### Login de Paciente via PIN
```http
POST /auth/patient-pin HTTP/1.1
Host: localhost:8787
Content-Type: application/json

{
  "cpf": "12345678901",
  "pin": "123456"
}
```
**204 No Content** → Cookie `Set-Cookie: patient_session=<token>; HttpOnly; Secure; SameSite=Strict`.

### Criação de Paciente
```http
POST /patients HTTP/1.1
Host: localhost:8787
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: 6e131b36-3b23-48b3-80c8-9ffb2d1b8f30

{
  "fullName": "Carlos Paciente",
  "cpf": "98765432100",
  "birthDate": "1990-05-02",
  "phone": "+55 11 98888-0000",
  "emergencyPhone": "+55 11 97777-0000",
  "stage": "in_treatment",
  "status": "active",
  "pin": "654321",
  "contacts": [
    {
      "fullName": "Maria Responsável",
      "relation": "Mãe",
      "phone": "+55 11 96666-0000",
      "isPrimary": true
    }
  ]
}
```
**201 Created** retorna o objeto `Patient` sem o PIN.

### Listagem Paginada de Consultas
```http
GET /appointments?day=2025-10-08&limit=10&offset=0 HTTP/1.1
Host: localhost:8787
Authorization: Bearer <token>
```
**200 OK**
```json
{
  "data": [
    {
      "id": 101,
      "patientId": 56,
      "professionalId": 42,
      "startsAt": "2025-10-08T13:30:00.000Z",
      "type": "return",
      "status": "scheduled",
      "notes": null,
      "createdAt": "2025-10-01T14:00:00.000Z",
      "updatedAt": "2025-10-01T14:00:00.000Z"
    }
  ],
  "meta": {
    "total": 4,
    "limit": 10,
    "offset": 0
  }
}
```

### Confirmação de Presença (Aplicativo Paciente)
```http
POST /appointments/101/confirm HTTP/1.1
Host: localhost:8787
Cookie: patient_session=<token>
```
**204 No Content** → registro de confirmação e auditoria associada.

### Exportação de Relatório
```http
GET /reports/attendance/export?format=pdf&start=2025-09-01&end=2025-09-30 HTTP/1.1
Host: localhost:8787
Authorization: Bearer <token-admin>
Accept: application/pdf
```
Resposta: `200 OK` com payload binário (`Content-Type: application/pdf`).

## Erros e Tratamento

| Código HTTP | `code`                | Quando ocorre                                     |
|-------------|----------------------|---------------------------------------------------|
| 400         | `VALIDATION_ERROR`   | Campos ausentes ou formato inválido.              |
| 401         | `INVALID_CREDENTIALS` ou `UNAUTHENTICATED` | Login incorreto ou token ausente.        |
| 403         | `FORBIDDEN`          | Papel sem permissão para a operação (`x-roles`).  |
| 404         | `NOT_FOUND`          | Recurso inexistente ou arquivado.                 |
| 409         | `UNIQUE_CONSTRAINT`  | CPF, documento, PIN duplicado, conflito de agenda.|
| 423         | `ACCOUNT_LOCKED`     | Paciente bloqueado após tentativas erradas de PIN.|
| 429         | `RATE_LIMITED`       | Limite de requisições excedido.                   |
| 500         | `INTERNAL_ERROR`     | Falha inesperada; log + telemetria obrigatórios.  |

Inclua `details` com campos específicos (ex.: `{ "field": "cpf", "reason": "already_exists" }`).

## Observabilidade & Auditoria

- Todas as mutações devem publicar eventos de log estruturado (`action`, `entity`, `actorId`, `correlationId`).
- Corrija IDs correlacionados (`X-Request-Id`) para rastrear chamadas de aplicativo.
- Integre métricas (latência, taxa de erro) a cada rota antes da fase de Observabilidade (PR-08).

## Próximos Passos

1. Implementar os handlers Hono conforme contratos (PR-05), garantindo validação (zod), RBAC e auditoria.
2. Gerar cliente tipado (por exemplo, `openapi-typescript` ou `orval`) para Web/Mobile a partir de `openapi.yaml`.
3. Automatizar linting/validação da especificação (ex.: `spectral`, `openapi-cli`) nas pipelines futuras.

Para ajustes ou dúvidas, atualize a OpenAPI e reflita as mudanças neste guia, mantendo a documentação viva ao longo das iterações.
