CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE baseline_clauses (
  id bigserial PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('Payment Terms','IP Rights','Liability','Termination','Confidentiality','Indemnification','Governing Law & Dispute Resolution','Non-Compete & Non-Solicitation')),
  text text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('safe','caution','risky')),
  rationale text NOT NULL,
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, text)
);
CREATE INDEX baseline_embedding_hnsw ON baseline_clauses USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);
CREATE TABLE analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL,
  file_name text NOT NULL, file_type text NOT NULL CHECK (file_type IN ('pdf','docx')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message text, overall_risk text CHECK (overall_risk IN ('safe','caution','risky')),
  summary jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX analyses_user_created ON analyses (user_id, created_at DESC);
CREATE TABLE clauses (
  id bigserial PRIMARY KEY, analysis_id uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0), category text NOT NULL, text text NOT NULL,
  risk_level text NOT NULL CHECK (risk_level IN ('safe','caution','risky')),
  similarity_score double precision CHECK (similarity_score BETWEEN -1 AND 1),
  matched_baseline_id bigint REFERENCES baseline_clauses(id),
  rule_flags jsonb NOT NULL DEFAULT '[]', explanation text,
  suggested_rewording text, semantic_signal text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (analysis_id, position)
);
CREATE INDEX clauses_analysis_position ON clauses (analysis_id, position);
