-- rag-doc-qa — full database setup.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).

-- 1. pgvector -----------------------------------------------------------------
create extension if not exists vector;

-- 2. Tables -------------------------------------------------------------------
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  filename text not null,
  content_type text,
  doc_type text,                       -- classification e.g. 'contract','report','note'
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  chunk_index int,
  content text not null,
  token_count int,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table if not exists query_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  query text,
  retrieved_chunk_ids uuid[],
  answer text,
  grounded boolean,                    -- did the model answer from context or refuse
  latency_ms int,
  created_at timestamptz default now()
);

create index if not exists chunks_embedding_idx
  on chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 3. Row-Level Security (the credibility piece — do not skip) ------------------
alter table documents enable row level security;
alter table chunks    enable row level security;
alter table query_log enable row level security;

drop policy if exists "own documents read"  on documents;
drop policy if exists "own documents write" on documents;
create policy "own documents read"  on documents for select using (auth.uid() = user_id);
create policy "own documents write" on documents for insert with check (auth.uid() = user_id);

drop policy if exists "own chunks read"  on chunks;
drop policy if exists "own chunks write" on chunks;
create policy "own chunks read"  on chunks for select using (auth.uid() = user_id);
create policy "own chunks write" on chunks for insert with check (auth.uid() = user_id);

drop policy if exists "own log read"  on query_log;
drop policy if exists "own log write" on query_log;
create policy "own log read"  on query_log for select using (auth.uid() = user_id);
create policy "own log write" on query_log for insert with check (auth.uid() = user_id);

-- 4. Retrieval RPC (cosine similarity in Postgres) ----------------------------
create or replace function match_chunks(
  query_embedding vector(1536),
  match_count int,
  filter_user_id uuid
)
returns table (id uuid, document_id uuid, content text, similarity float)
language sql stable
as $$
  select c.id, c.document_id, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.user_id = filter_user_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
