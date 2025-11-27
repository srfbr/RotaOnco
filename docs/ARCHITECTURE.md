# RotaOnco — Arquitetura Alvo

## Visão Geral
- Plataforma distribuída composta por aplicações Web (TanStack Router + React) e Mobile (Expo + React Native + NativeWind) consumindo APIs Hono executadas sobre Bun.
- Persistência centralizada em MySQL operacionalizada via Drizzle ORM e gerenciada por migrations versionadas.
- Autenticação e autorização providas por Better Auth com RBAC (paciente, profissional, administrador) e proteção contra abuso (rate limiting, bloqueio após três tentativas).
- Camada de integração para notificações assíncronas (WhatsApp prioritário, SMS fallback) desacoplada via adapters, permitindo troca futura de provedores.
- Observabilidade com logs estruturados, métricas e trilhas de auditoria para operações críticas.

## Diretrizes de Arquitetura e Trade-offs
- **Single database, múltiplos clientes**: favorece consistência dos dados e simplifica relatórios, à custa de exigir controles rígidos de RBAC.
- **Hono + Bun**: serverless-friendly e leve para APIs de baixa latência; exige disciplina para bibliotecas compatíveis com o runtime.
- **Better Auth**: acelera a implementação de fluxos de login com MFA/PIN e RBAC, porém demanda integração cuidadosa com políticas de bloqueio.
- **Jobs assíncronos para lembretes**: garante SLA de envio sem bloquear requisições interativas; introduz complexidade operacional (fila ou scheduler).
- **Expo + NativeWind**: aumenta produtividade no mobile com hot reload e design consistente, mas requer atenção às limitações de performance em dispositivos modestos.
- **TanStack Router**: fornece roteamento e loaders declarativos, simplificando data fetching e estados, porém exige tipagem rigorosa para manter coesão.

## Diagrama de Contexto
```mermaid
flowchart LR
    subgraph Pacientes
        AppPaciente["App Mobile (Expo)"]
    end

    subgraph Profissionais
        WebApp["Web Dashboard (React/TanStack)"]
    end

    subgraph Backend
        APIServer["API Hono (Bun)"]
        AuthService["Better Auth"]
        DB[("MySQL / Drizzle")]
        JobRunner["Job Scheduler / Queue"]
        NotifAdapters["Adapters WhatsApp / SMS"]
        Storage["Object Storage (áudios, docs)"]
        Observability["Logs & Métricas"]
    end

    AppPaciente -->|REST/HTTPS| APIServer
    WebApp -->|REST/HTTPS| APIServer
    APIServer -->|Auth handshake| AuthService
    APIServer -->|SQL| DB
    APIServer -->|Emit events| JobRunner
    JobRunner -->|Invoke| NotifAdapters
    APIServer -->|Upload URL| Storage
    APIServer -->|Logs/Metrics| Observability
    JobRunner -->|Logs/Metrics| Observability
```

## Componentes Principais
- **apps/web**: SPA protegida por RBAC com layouts exclusivos para profissionais e administradores; consome cliente gerado a partir do OpenAPI.
- **apps/native**: App mobile em Expo com fluxos de paciente e profissional, armazenamento seguro de PIN/token e suporte a áudio.
- **apps/server (API)**: Hono + Bun com middlewares (auth Better Auth, rate limiting, auditoria, validação com Zod) e camadas (routes → controllers → services → repositories).
- **packages/shared**: tipos TypeScript compartilhados, cliente OpenAPI e utilitários (formatadores, regras de negócio reutilizáveis).
- **Infraestrutura**: Docker Compose para MySQL local, scripts de seeds (Drizzle), pipelines de CI/CD (.github/workflows), configuração de observabilidade.
- **Notificações**: módulo agnóstico de provedores com abstração `NotificationService`, adapters `WhatsAppAdapter` e `SmsAdapter`, e fila `notification_jobs`.

```mermaid
graph TD
    subgraph Client Apps
        Web[Web SPA]
        Mobile[Mobile App]
    end

    subgraph API Layer
        Router[Hono Router]
        Middleware[Auth / RBAC / RateLimiter]
        Services[Use Cases]
        Repos[Drizzle Repositories]
    end

    subgraph Data & Integrations
        MySQL[(MySQL)]
        Audit[(Audit Logs)]
        Queue[(Job Queue)]
        NotifAdapters2[Notification Adapters]
        Storage2[(Object Storage)]
    end

    Web --> Router
    Mobile --> Router
    Router --> Middleware
    Middleware --> Services
    Services --> Repos
    Repos --> MySQL
    Services --> Audit
    Services --> Queue
    Queue --> NotifAdapters2
    Services --> Storage2
```

## Topologia por Ambiente
```mermaid
flowchart TB
    subgraph Local
        DevMachine["Dev Machine"] --> DockerMySQL["Docker MySQL"]
        DevMachine --> LocalAPI["Bun Hono (hot reload)"]
        DevMachine --> LocalWeb["Vite Dev Server"]
        DevMachine --> LocalExpo["Expo Dev"]
    end

    subgraph Staging
        StagingUsers(Web/Mobile) --> StagingLB["Reverse Proxy / API Gateway"]
        StagingLB --> StagingAPI["API Hono (container)"]
        StagingAPI --> StagingDB[(Managed MySQL)]
        StagingAPI --> StagingQueue["Worker / Scheduler"]
        StagingQueue --> StagingAdapters["WhatsApp/SMS Sandbox"]
    end

    subgraph Production
        ProdUsers --> ProdWAF["WAF / Load Balancer"]
        ProdWAF --> ProdAPICluster["API Hono Cluster"]
        ProdAPICluster --> ProdDBCluster[(MySQL HA)]
        ProdAPICluster --> ProdQueue["Job Workers"]
        ProdQueue --> ProdAdapters["WhatsApp/SMS Providers"]
        ProdAPICluster --> ProdObservability["Observability Stack"]
        ProdAPICluster -.-> ProdStorage[(Object Storage)]
    end
```

- **Local**: foco em produtividade (hot reload), dados artificiais e seeds mínimos.
- **Staging**: ambiente espelho com autenticação real e integrações em modo sandbox; usado para QA/UAT.
- **Produção**: múltiplas réplicas da API atrás de balanceador, MySQL em alta disponibilidade, workers horizontais e observabilidade centralizada.

## Sequências Principais
### Cadastro de Profissional
```mermaid
sequenceDiagram
    participant Admin as Administrador
    participant Web
    participant API as API Hono
    participant Auth as Better Auth
    participant DB as MySQL

    Admin ->> Web: Preenche formulário de cadastro
    Web ->> API: POST /professionals (dados + papéis)
    API ->> API: Validar dados (Zod)
    API ->> Auth: CreateUser + atribuir RBAC
    Auth -->> API: Confirma criação
    API ->> DB: Insert user, roles, audit_log
    DB -->> API: OK
    API -->> Web: 201 Created + detalhes
    API ->> DB: Registrar auditoria (ação=CREATE_PROFESSIONAL)
```

### Login Profissional
```mermaid
sequenceDiagram
    participant Prof as Profissional
    participant Web
    participant API
    participant Auth
    participant DB

    Prof ->> Web: Submete credenciais
    Web ->> API: POST /auth/login
    API ->> Auth: Validate credentials
    Auth -->> API: JWT + roles (ou erro)
    API ->> DB: Registrar tentativa (sucesso/falha)
    API -->> Web: 200 OK + tokens
    Web ->> Web: Armazena tokens seguros
```

### Login Paciente via PIN
```mermaid
sequenceDiagram
    participant Pac as Paciente
    participant Mobile
    participant API
    participant Auth
    participant DB

    Pac ->> Mobile: Informa PIN de 4 dígitos
    Mobile ->> API: POST /auth/patient-pin
    API ->> DB: Buscar paciente e PIN hash
    API ->> API: Validar tentativas (>=3 bloqueia)
    API ->> Auth: Emitir token escopo paciente
    Auth -->> API: Token paciente
    API ->> DB: Reset contador ou registrar falha
    API -->> Mobile: 200 OK + token/expiração
```

### Agendar Consulta
```mermaid
sequenceDiagram
    participant Prof
    participant Web
    participant API
    participant DB
    participant Queue as Job Queue

    Prof ->> Web: Seleciona paciente e horário
    Web ->> API: POST /appointments (dados, tipo)
    API ->> API: Validar conflitos / regras (quinzenal/trimestral)
    API ->> DB: Insert appointment + audit_log
    DB -->> API: OK
    API ->> Queue: Enfileirar lembrete futuro
    API -->> Web: 201 Created + detalhes
```

### Confirmação de Presença
```mermaid
sequenceDiagram
    participant Pac
    participant Mobile
    participant API
    participant DB

    Pac ->> Mobile: Toca em "Confirmar"
    Mobile ->> API: POST /appointments/{id}/confirm
    API ->> DB: Atualizar status (confirmed)
    API ->> DB: Registrar auditoria
    DB -->> API: OK
    API -->> Mobile: 200 OK + status atualizado
```

### Registro de Intercorrência
```mermaid
sequenceDiagram
    participant Prof
    participant Web
    participant API
    participant DB
    participant Alert as Alert Engine

    Prof ->> Web: Preenche ocorrência
    Web ->> API: POST /patients/{id}/occurrences
    API ->> API: Validar payload e RBAC
    API ->> DB: Insert occurrence + audit_log
    DB -->> API: OK
    API ->> Alert: Avaliar se gera alerta (ex.: sintomas graves)
    Alert -->> API: Opcional: criar alerta/notification
    API -->> Web: 201 Created
```

### Lembrete Automático
```mermaid
sequenceDiagram
    participant Scheduler
    participant Queue
    participant Worker
    participant API
    participant DB
    participant WhatsApp
    participant SMS

    Scheduler ->> Queue: Dispara job (cron)
    Queue ->> Worker: Entrega mensagem
    Worker ->> DB: Buscar agendamentos pendentes
    Worker ->> WhatsApp: Enviar template
    alt Falha WhatsApp
        Worker ->> SMS: Enviar fallback
    end
    Worker ->> DB: Registrar message log (status)
    Worker ->> API: Emitir eventos/telemetria
```

### Geração de Relatório
```mermaid
sequenceDiagram
    participant Admin
    participant Web
    participant API
    participant DB
    participant Storage

    Admin ->> Web: Solicita relatório (ex.: comparecimento)
    Web ->> API: GET /reports/attendance?range=...
    API ->> DB: Executa consultas agregadas otimizadas
    DB -->> API: Dados agregados
    API ->> API: Gerar agregações + opcionalmente PDF/XLSX
    alt Exportação arquivo
        API ->> Storage: Upload arquivo
        Storage -->> API: URL temporária
    end
    API -->> Web: 200 OK (dados ou link de download)
```

## Segurança e Compliance
- **Autenticação**: Better Auth (profissionais/administradores via login, pacientes via PIN), tokens curtos + refresh, armazenamento seguro (SecureStore / HttpOnly).
- **Autorização**: middleware RBAC centralizado; negação por padrão e checagem granular por rota.
- **Proteções**: rate limiting em auth/ações críticas, bloqueio após três tentativas falhas, validação de CPF único, auditoria para CRUD sensíveis.
- **LGPD**: categorização de PII (CPF, dados clínicos); logs com mínimos necessários; segregação de dados por perfil.

## Observabilidade e Operação
- **Logging**: Pino (ou semelhante) estruturado com correlação de requisições e jobs.
- **Métricas**: coletas de latência, throughput, taxa de erro, fila de lembretes e bloqueios de login.
- **Tracing**: opcional (OpenTelemetry) para fluxos críticos.
- **Alerting**: thresholds em latência (>3s), erro (>5%), congestionamento de fila, falhas consecutivas de envio de mensagens.

## Próximos Passos
1. Refinar modelo de dados com base nas decisões (PR-03) e gerar ERD + migrations.
2. Detalhar integração com provedores de notificações quando decisão for tomada.
3. Planejar infraestrutura de observabilidade (stack ELK/OTel) e CI/CD.
