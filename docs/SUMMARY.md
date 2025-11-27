# RotaOnco — Sumário de Requisitos

## Escopo
- Plataforma integrada para gestão clínica em estomatologia oncológica, composta por Dashboard Web (profissionais e administradores) e App Mobile (pacientes e profissionais) compartilhando uma única base de dados.
- Abrange cadastro e validação de profissionais, gerenciamento de pacientes, agenda de consultas, registro de intercorrências, indicadores clínicos, geração de relatórios e disparo de lembretes (WhatsApp prioritário, SMS fallback).
- Suporta perfis RBAC: paciente, profissional e administrador, com diferenciação de acessos e operações conforme perfil.

## Atores / Perfis
- **Paciente**: acessa via PIN de 4 dígitos; visualiza consultas, confirma presença, acessa conteúdos em áudio, efetua ligações rápidas e botão de emergência; não envia mensagens/áudios.
- **Profissional**: cadastro com validação institucional; no web dashboard gerencia agenda, pacientes, presenças/faltas, intercorrências e relatórios básicos. No app mobile visualiza apenas seus pacientes, alertas (faltas consecutivas, intercorrências), compromissos marcados e ajustes de agenda (sem edição de perfil ou dados sensíveis adicionais).
- **Administrador**: valida profissionais, gerencia permissões, configura parâmetros do sistema e acessa relatórios completos.

## Fluxos Essenciais
- **Cadastro de profissional (RF001)**: submissão de dados, validação institucional por administrador e atribuição de papéis.
- **Cadastro de paciente (RF002)**: registro com CPF como chave única, contatos de emergência e materiais de áudio.
- **Login profissional (RF003)**: autenticação forte (Better Auth) com bloqueio após três falhas, sessão JWT.
- **Login paciente via PIN (RF004)**: verificação de PIN de 4 dígitos (sem CPF), bloqueio temporário após três tentativas.
- **Agenda profissional (RF007/RF028)**: visualização diária, registro de presença/falta, atualização de status.
- **Confirmação de presença (RF006)**: paciente confirma via app, atualiza status do agendamento.
- **Registro de intercorrência (RF012)**: profissional (ou paciente supervisionado) lança ocorrência com tipo, intensidade e notas.
- **Lembretes automáticos (RF014)**: sistema agenda e envia lembretes via WhatsApp (primário) ou SMS (fallback), registrando mensagens.
- **Alertas de risco (RF013/RF029)**: detecção de faltas consecutivas ou eventos críticos, geração de alertas com fluxo de acompanhamento.
- **Relatórios e indicadores (RF016–RF020)**: geração de métricas de comparecimento, tempos de espera, adesão e exportação em PDF/XLSX para perfis autorizados (profissionais e administradores).

## Requisitos Não Funcionais (RNF01–RNF09)
| Código | Descrição | Situação |
|--------|-----------|----------|
| RNF01 | Não há requisito adicional específico além dos já descritos (confirmado). | Definido |
| RNF02 | Não há requisito adicional específico além dos já descritos (confirmado). | Definido |
| RNF03 | Suportar até 5.000 pacientes cadastrados e ~100 acessos concorrentes. | Definido |
| RNF04 | Disponibilidade mínima de 99,5%. | Definido |
| RNF05 | Acessibilidade conforme WCAG 2.1 e apoio a áudio no app do paciente. | Definido |
| RNF06 | Tempo de resposta ≤ 3s para operações comuns e ≤ 10s para relatórios complexos. | Definido |
| RNF07 | Bloqueio de credenciais/pin após 3 tentativas incorretas. (Associado também a segurança RS002.) | Implicado |
| RNF08 | Auditoria das operações críticas com usuário, data/hora e ação. | Definido |
| RNF09 | Não há requisito adicional específico além dos já descritos (confirmado). | Definido |

## Riscos
- Dependência de integrações externas (WhatsApp e SMS); escolhas de provedores podem impactar custo e prazo.
- Necessidade de conformidade com LGPD: tratamento de PII (CPF, dados clínicos) exige controles rigorosos.
- Limitada definição de infraestrutura (topologia, escalabilidade) pode atrasar decisões de deploy e observabilidade.
- Adoção simultânea de múltiplas frentes (Web, Mobile, API) aumenta a complexidade de coordenação e versionamento.
- Possibilidade de ajustes posteriores nas regras de alerta/indicadores conforme feedback clínico, exigindo planejamento para mudanças controladas.

## Suposições
- Papéis ativos se restringem a paciente, profissional e administrador; pesquisador foi removido do escopo atual.
- CPF é obrigatório para pacientes e profissionais, servindo como chave única de identificação.
- Existe um administrador inicial responsável por validar cadastros e definir configurações iniciais do sistema.
- Materiais de áudio para pacientes estarão disponíveis via URLs armazenadas no sistema (não hospedados dentro do app).
- Infrastructure baseará em Docker para MySQL (via Drizzle) e pipelines CI/CD definidos posteriormente.
- Ausência de política formal de retenção/anonimização declarada; dados serão mantidos enquanto necessários para operação e pesquisa interna.
- Sistema atuará em única unidade clínica (sem multiunidade), simplificando regras de acesso.

## Decisões Recentes
- Tipos de consulta são definidos pelo profissional no momento do agendamento (tratamento, retorno, triagem etc.).
- Alerta de faltas consecutivas é disparado quando o paciente acumula mais de uma ausência seguida (duas ou mais).
- Não haverá política formal adicional de retenção/anonimização além da guarda operacional necessária.
- Sistema será implantado para uma única unidade clínica, sem segregação multiunidade.

## Perguntas Abertas
- Quem será o provedor escolhido para WhatsApp (ex.: Meta Cloud API, parceiro terceiro) e SMS (provedor e requisitos de template)? **Pendente** — decisão em standby.
