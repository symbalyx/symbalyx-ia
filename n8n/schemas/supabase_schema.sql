-- =============================================================
-- Symbalyx — schéma Supabase / Postgres (V4)
-- Compatible 1-pour-1 avec les onglets Google Sheets actuels.
-- À appliquer plus tard, après avoir validé le système en Sheets.
-- =============================================================

create extension if not exists "uuid-ossp";

-- ----------------- Configuration / kill switch -----------------
create table if not exists config (
  key         text primary key,
  value       text not null,
  notes       text,
  updated_at  timestamptz default now()
);

-- ----------------- Users / RBAC simple -----------------
create table if not exists users (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  email       text unique not null,
  role        text not null default 'operator',  -- owner | operator | viewer
  active      boolean not null default true,
  created_at  timestamptz default now()
);

-- ----------------- Team members (V8 — référentiel équipe agence) -----------------
-- Source de vérité pour les identités utilisées dans le CRM (login step 2)
-- et dans tous les workflows (decider_id, author_id, assignee_id).
-- Note : distinct de `users` (users = comptes auth/RBAC potentiels) pour rester
-- découplé d'une éventuelle bascule d'auth.
create table if not exists team_members (
  id          text primary key,                           -- ex: tm_arsene
  name        text not null,
  email       text,
  role        text not null default 'member',             -- founder | admin | sales | dev | viewer | member
  initials    text,
  color       text,                                       -- hex CSS, ex: #3a86ff
  is_active   boolean not null default true,
  created_at  timestamptz default now()
);
create index if not exists idx_tm_active on team_members(is_active);

-- ----------------- Prospects in -----------------
create table if not exists prospects_in (
  id            text primary key,
  company_name  text not null,
  contact_name  text,
  email         text,
  website_url   text,
  city          text,
  niche         text,
  notes         text,
  source_url    text,
  opt_out       boolean default false
);

-- ----------------- Review queue -----------------
create table if not exists review_queue (
  id                          text primary key,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  status                      text,
  company_name                text,
  contact_name                text,
  email                       text,
  website_url                 text,
  city                        text,
  niche                       text,
  business_summary            text,
  website_status              text,
  opportunity_score           numeric,
  opportunity_reason          text,
  suggested_angle             text,
  project_difficulty_score    numeric,
  project_difficulty_label    text,
  project_difficulty_reason   text,
  draft_email_subject         text,
  draft_email_body            text,
  assigned_to                 text,
  human_decision              text,
  human_notes                 text,
  reply_category              text,
  reply_text                  text,
  reply_received_at           timestamptz,
  reply_opt_out               boolean default false,
  follow_up_date              date,
  priority_score              numeric,
  priority_level              text
);
create index if not exists idx_review_email on review_queue(email);
create index if not exists idx_review_status on review_queue(status);

-- ----------------- Project queue -----------------
create table if not exists project_queue (
  id                            text primary key,
  prospect_id                   text references review_queue(id) on delete set null,
  created_at                    timestamptz default now(),
  updated_at                    timestamptz default now(),
  status                        text,            -- new|in_progress|blocked|delivered|abandoned
  client_name                   text,
  niche                         text,
  city                          text,
  email                         text,
  client_brief_summary          text,
  recommended_website_prompt    text,
  estimated_project_scope       jsonb,
  estimated_project_complexity  text,
  next_questions_to_ask         jsonb,
  assigned_to                   text,
  estimated_hours               numeric,
  priority                      text,
  notes                         text,
  deadline                      date,
  priority_score                numeric,
  priority_level                text,
  risk_level                    text,
  expected_value                numeric
);

-- ----------------- Team state -----------------
create table if not exists team_state (
  name                      text primary key,
  role                      text,
  current_load_pct          int default 0,
  weekly_capacity_hours     int default 35,
  current_committed_hours   int default 0,
  unavailable_days          text[]
);

-- ----------------- Business control -----------------
create table if not exists business_control (
  id                          text primary key,
  ts                          timestamptz default now(),
  run_id                      text,
  source_workflow             text,
  item_type                   text,         -- prospect|project|ops|follow_up|finance_light
  item_id                     text,
  title                       text,
  recommendation              text,
  recommended_action          text,
  priority_score              numeric,
  priority_level              text,         -- low|medium|high|critical
  expected_impact             text,
  effort_level                text,
  assigned_to                 text,                                          -- nom display (rétro-compat)
  assignee_id                 text references team_members(id) on delete set null,
  requires_human_validation   boolean default true,
  decision_status             text default 'pending',  -- pending|approved|rejected|done|snoozed
  decided_by                  text,                                          -- nom display (rétro-compat)
  decider_id                  text references team_members(id) on delete set null,
  decided_at                  timestamptz,
  notes                       text
);
create index if not exists idx_bcl_decision_status on business_control(decision_status);
create index if not exists idx_bcl_priority_level on business_control(priority_level);
create index if not exists idx_bcl_ts on business_control(ts desc);
create index if not exists idx_bcl_assignee on business_control(assignee_id);

-- ----------------- KPI snapshots -----------------
create table if not exists kpi_snapshots (
  ts                                  timestamptz default now(),
  run_id                              text,
  period                              text,
  prospects_total                     int,
  prospects_pending                   int,
  prospects_in_review                 int,
  prospects_drafted                   int,
  prospects_replied_interested        int,
  prospects_replied_not_interested    int,
  projects_active                     int,
  projects_blocked                    int,
  projects_due_soon                   int,
  team_load_arsene_pct                int,
  team_load_kentin_pct                int,
  high_priority_count                 int,
  critical_count                      int,
  notes                               text,
  primary key (ts, run_id)
);

-- ----------------- Weekly recommendations (legacy WF6) -----------------
create table if not exists weekly_recommendations (
  ts                timestamptz default now(),
  run_id            text,
  project_id        text,
  client            text,
  complexity        text,
  assigned_to       text,
  estimated_hours   numeric,
  priority          text,
  reason            text
);

-- ----------------- Logs -----------------
create table if not exists logs (
  ts            timestamptz default now(),
  prospect_id   text,
  phase         text,
  status        text,
  level         text,         -- info|warn|error
  message       text,
  meta          jsonb
);
create index if not exists idx_logs_ts on logs(ts desc);
create index if not exists idx_logs_level on logs(level);

-- ----------------- Agency ops -----------------
create table if not exists client_onboarding (
  id                          text primary key,
  ts                          timestamptz default now(),
  project_id                  text references project_queue(id) on delete set null,
  client_name                 text,
  status                      text,
  welcome_email_subject       text,
  welcome_email_body          text,
  intake_questions            jsonb,
  assets_to_collect           jsonb,
  kickoff_agenda              jsonb,
  deliverables_milestones     jsonb,
  risks_to_flag               jsonb,
  human_validation_required   boolean default true
);

create table if not exists client_reports (
  id                      text primary key,
  ts                      timestamptz default now(),
  project_id              text references project_queue(id) on delete set null,
  client_name             text,
  email                   text,
  subject                 text,
  body                    text,
  questions_for_client    jsonb,
  status                  text
);

create table if not exists kb_articles (
  id          text primary key,
  title       text not null,
  body        text not null,
  tags        text,
  source      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- TODO future: ajouter colonne `embedding vector(1536)` + index pgvector
-- pour passer du retrieval lexical au sémantique.

create table if not exists invoices (
  id              text primary key,
  invoice_ref     text,
  project_id      text references project_queue(id) on delete set null,
  client_name     text,
  client_email    text,
  amount_eur      numeric,
  issued_at       date,
  due_date        date,
  status          text,        -- draft|sent|paid|overdue|partial|cancelled
  paid_at         date,
  notes           text
);

-- ----------------- Memory: decisions (V7+ — ferme la boucle d'apprentissage) -----------------
create table if not exists memory_decisions (
  id                    text primary key,
  ts                    timestamptz default now(),
  bcl_id                text,
  item_type             text,
  item_id               text,
  recommended_action    text,
  ai_initial_priority   text,         -- priority_level capturé au moment de la reco
  decision              text,         -- approved|rejected|snoozed|abandoned
  decided_by            text,         -- nom display (rétro-compat)
  decider_id            text references team_members(id) on delete set null,
  reason                text,
  outcome               text,         -- rempli a posteriori (reply_received|no_reply|delivered|...)
  outcome_observed_at   timestamptz
);
create index if not exists idx_memdec_bcl on memory_decisions(bcl_id);
create index if not exists idx_memdec_item on memory_decisions(item_type, item_id);
create index if not exists idx_memdec_decider on memory_decisions(decider_id);

-- ----------------- Team comments (V7+ — synchro équipe) -----------------
create table if not exists team_comments (
  id          text primary key,
  ts          timestamptz default now(),
  item_type   text not null,                    -- bcl|prospect|project|invoice
  item_id     text not null,
  author      text not null,                    -- nom display (rétro-compat)
  author_id   text references team_members(id) on delete set null,
  body        text not null,
  resolved    boolean default false,
  parent_id   text                              -- pour threads (optionnel)
);
create index if not exists idx_tc_item on team_comments(item_type, item_id);
create index if not exists idx_tc_ts on team_comments(ts desc);
create index if not exists idx_tc_author on team_comments(author_id);

-- ----------------- Vue agrégée pour le dashboard -----------------
create or replace view v_dashboard_summary as
select
  (select count(*) from review_queue) as prospects_total,
  (select count(*) from review_queue where status = 'queued_for_review') as prospects_pending,
  (select count(*) from review_queue where status = 'drafted_in_gmail') as prospects_drafted,
  (select count(*) from review_queue where reply_category = 'interested') as replies_interested,
  (select count(*) from project_queue where status in ('new','in_progress')) as projects_active,
  (select count(*) from project_queue where status = 'blocked') as projects_blocked,
  (select count(*) from business_control where decision_status = 'pending') as bcl_pending,
  (select count(*) from business_control where decision_status = 'pending' and priority_level = 'critical') as bcl_critical;
