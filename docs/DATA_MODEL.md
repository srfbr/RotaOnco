# RotaOnco — Modelo de Dados

## Glossário de Entidades
- **users**: profissionais e administradores autenticados via Better Auth.
- **roles** / **user_roles**: papéis RBAC (admin, professional).
- **patients**: pacientes acompanhados; inclui informações clínicas e contatos de emergência.
- **patient_contacts**: contatos relacionados ao paciente (familiar/responsável).
- **patient_status_history**: histórico de estágios clínicos e status de risco.
- **appointments**: agendamentos, retornos e triagens com vínculo a paciente e profissional.
- **appointment_reminders**: registros de lembretes enviados (WhatsApp/SMS) e status.
- **occurrences**: intercorrências lançadas pelos profissionais (ou sob supervisão).
- **alerts**: alertas gerados para faltas consecutivas ou intercorrências críticas.
- **messages**: fila de mensagens de notificação (WhatsApp/SMS) com logs de envio.
- **audit_logs**: trilhas de auditoria com usuário, ação e detalhes.
- **settings**: parâmetros administráveis (ex.: telefones de emergência).

## Diagramas ERD
```mermaid
erDiagram
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : has
    users ||--o{ appointments : schedules
    patients ||--o{ appointments : has
    patients ||--o{ patient_contacts : has
    patients ||--o{ occurrences : has
    patients ||--o{ alerts : triggers
    patients ||--o{ messages : receives
    appointments ||--o{ appointment_reminders : generates
    patients ||--o{ patient_status_history : traces
    users ||--o{ audit_logs : produces
    settings ||--o{ audit_logs : references

    users {
      bigint id PK
      varchar external_id UK // referência Better Auth
      varchar name
      varchar email UK
      varchar document_id UK // CPF/CRM/CRO
      varchar specialty
      varchar phone
      boolean is_active
      datetime created_at
      datetime updated_at
    }

    roles {
      int id PK
      varchar name UK // admin, professional
      varchar description
    }

    user_roles {
      bigint user_id FK
      int role_id FK
      datetime assigned_at
      PRIMARY KEY (user_id, role_id)
    }

    patients {
      bigint id PK
      varchar full_name
      varchar cpf UK
      date birth_date
      varchar phone
      varchar emergency_phone
      varchar tumor_type
      varchar clinical_unit
      enum stage // pre_triage, in_treatment, post_treatment
      enum status // active, inactive, at_risk
      varchar audio_material_url
      int pin_attempts DEFAULT 0
      datetime pin_blocked_until
      varchar pin_hash UK // hash Argon2 de PIN (6 dígitos)
      datetime created_at
      datetime updated_at
    }

    patient_contacts {
      bigint id PK
      bigint patient_id FK
      varchar full_name
      varchar relation
      varchar phone
      boolean is_primary
      datetime created_at
      datetime updated_at
    }

    patient_status_history {
      bigint id PK
      bigint patient_id FK
      enum stage
      enum status
      text notes
      datetime recorded_at
      bigint recorded_by FK
    }

    appointments {
      bigint id PK
      bigint patient_id FK
      bigint professional_id FK
      datetime starts_at
      varchar type // triage, treatment, return
      enum status // scheduled, confirmed, completed, no_show, canceled
      text notes
      datetime created_at
      datetime updated_at
    }

    appointment_reminders {
      bigint id PK
      bigint appointment_id FK
      enum channel // whatsapp, sms
      datetime scheduled_for
      datetime sent_at
      enum status // queued, sent, failed
      text error
      datetime created_at
    }

    occurrences {
      bigint id PK
      bigint patient_id FK
      bigint professional_id FK
      varchar kind
      tinyint intensity // 0..10
      enum source // patient, professional
      text notes
      datetime created_at
    }

    alerts {
      bigint id PK
      bigint patient_id FK
      varchar kind
      enum severity // low, medium, high
      enum status // open, acknowledged, closed
      text details
      datetime created_at
      datetime resolved_at
      bigint resolved_by FK
    }

    messages {
      bigint id PK
      bigint patient_id FK
      enum channel // whatsapp, sms
      text body
      varchar media_url
      enum status // queued, sent, failed
      datetime scheduled_at
      datetime sent_at
      text error
      bigint appointment_id FK NULL
      datetime created_at
    }

    audit_logs {
      bigint id PK
      bigint user_id FK NULL
      varchar action
      varchar entity
      bigint entity_id
      json details
      varchar ip_address
      varchar user_agent
      datetime created_at
    }

    settings {
      varchar key PK
      varchar value
      varchar description
      datetime updated_at
      bigint updated_by FK NULL
    }
```

## PII e Retenção
- **Dados sensíveis**: CPF (`patients.cpf`, `users.document_id`), dados clínicos (`patients.tumor_type`, `occurrences.notes`), contatos (`patient_contacts.phone`) e PIN de 6 dígitos (armazenado como hash Argon2 único em `patients.pin_hash`). Requer transporte seguro (HTTPS) e, quando aplicável, encriptação em repouso.
- **PIN**: contador de tentativas (`pin_attempts`) e bloqueio temporário (`pin_blocked_until`), com índice único para evitar colisões entre pacientes.
- **Retenção**: sem política formal adicional; dados mantidos enquanto necessários à operação e pesquisa interna. Ajustável futuramente via `settings`.
- **Auditoria**: registros permanentes em `audit_logs` até definição de política de retenção.

## Compliance
- RBAC aplicado a todas as entidades sensíveis por meio de `user_roles`.
- Unicidade de CPF/CRM/CRO e PIN garantida via índices dedicados.
- Logs de auditoria armazenam usuário, ação, entidade, IP e user-agent para rastreabilidade.
- Mensagens outbound gravam canal, status e erros para fins de comprovação e troubleshooting.

## Next Steps
- Implementar/atualizar schemas Drizzle e migrações (refletidas em `apps/server/src/db/schema`).
- Configurar seeds idempotentes (administrador inicial, paciente exemplo, agenda).
- Integrar lógica de detecção de faltas consecutivas e geração de alertas na camada de serviços.
- Revisar periodicamente a necessidade de anonimização/retensão conforme políticas institucionais.

