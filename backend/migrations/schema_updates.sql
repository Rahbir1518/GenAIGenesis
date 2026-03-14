-- ============================================================================
-- Schema Updates for ContextBridge
-- Run these in the Supabase SQL Editor
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FIX: Embedding dimension
-- The Gemini embedding model outputs 768 dims by default.
-- Must drop the dependent view and index first, then recreate after.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS tree_nodes_with_staleness;
DROP INDEX IF EXISTS tree_nodes_embedding_idx;

ALTER TABLE tree_nodes
  ALTER COLUMN embedding TYPE vector(768);

-- Recreate the IVFFlat index for the new dimension
CREATE INDEX ON tree_nodes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ---------------------------------------------------------------------------
-- 2. Create onboarding_sessions table (if not exists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_sessions (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id          text NOT NULL,
  user_name        text,
  role             text,
  raw_responses    jsonb NOT NULL DEFAULT '{}',
  ai_persona_summary text,
  goals            text[],
  status           text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_workspace
  ON onboarding_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_user
  ON onboarding_sessions(user_id);

ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read onboarding" ON onboarding_sessions;
CREATE POLICY "members can read onboarding"
  ON onboarding_sessions FOR SELECT
  USING (is_member(workspace_id));

DROP POLICY IF EXISTS "members can insert onboarding" ON onboarding_sessions;
CREATE POLICY "members can insert onboarding"
  ON onboarding_sessions FOR INSERT
  WITH CHECK (is_member(workspace_id));

DROP POLICY IF EXISTS "own user can update onboarding" ON onboarding_sessions;
CREATE POLICY "own user can update onboarding"
  ON onboarding_sessions FOR UPDATE
  USING (user_id::text = auth.jwt() ->> 'sub');


-- ---------------------------------------------------------------------------
-- 3. Create sales_records table (if not exists)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_records (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title            text NOT NULL,
  raw_text         text NOT NULL,
  summary          text,
  source_type      text DEFAULT 'manual' CHECK (source_type IN ('manual', 'transcript', 'email')),
  metadata         jsonb DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_records_workspace
  ON sales_records(workspace_id);

ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read sales records" ON sales_records;
CREATE POLICY "members can read sales records"
  ON sales_records FOR SELECT
  USING (is_member(workspace_id));

DROP POLICY IF EXISTS "members can insert sales records" ON sales_records;
CREATE POLICY "members can insert sales records"
  ON sales_records FOR INSERT
  WITH CHECK (is_member(workspace_id));

DROP POLICY IF EXISTS "members can update sales records" ON sales_records;
CREATE POLICY "members can update sales records"
  ON sales_records FOR UPDATE
  USING (is_member(workspace_id));


-- ---------------------------------------------------------------------------
-- 4. FIX: question_type constraint
-- The AI classifier returns types like 'engineering', 'sales', 'general',
-- 'onboarding' but the current constraint only allows 'capability', etc.
-- ---------------------------------------------------------------------------
ALTER TABLE questions
  DROP CONSTRAINT IF EXISTS questions_question_type_check;

ALTER TABLE questions
  ADD CONSTRAINT questions_question_type_check
  CHECK (question_type IN (
    'capability', 'status', 'ownership', 'comparison', 'urgent',
    'engineering', 'sales', 'general', 'onboarding'
  ));


-- ---------------------------------------------------------------------------
-- 5. Ensure tree_nodes_with_staleness view exists
-- (should already exist from initial migration, but just in case)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW tree_nodes_with_staleness AS
SELECT
  *,
  EXTRACT(DAY FROM now() - updated_at)::int AS staleness_days,
  CASE
    WHEN EXTRACT(DAY FROM now() - updated_at) <= 7  THEN 'green'
    WHEN EXTRACT(DAY FROM now() - updated_at) <= 21 THEN 'amber'
    ELSE 'red'
  END AS staleness_status,
  ROUND(
    (confidence * EXP(-EXTRACT(DAY FROM now() - updated_at) / 14.0))::numeric,
    3
  ) AS effective_confidence
FROM tree_nodes;


-- ---------------------------------------------------------------------------
-- 6. Auto-update updated_at triggers for new tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- onboarding_sessions
DROP TRIGGER IF EXISTS update_onboarding_sessions_updated_at ON onboarding_sessions;
CREATE TRIGGER update_onboarding_sessions_updated_at
    BEFORE UPDATE ON onboarding_sessions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- sales_records
DROP TRIGGER IF EXISTS update_sales_records_updated_at ON sales_records;
CREATE TRIGGER update_sales_records_updated_at
    BEFORE UPDATE ON sales_records
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();


-- ---------------------------------------------------------------------------
-- 7. Add Realtime for new tables (optional, for live UI updates)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE onboarding_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE sales_records;


-- ---------------------------------------------------------------------------
-- 8. Ensure apply_feedback RPC exists
-- (should already exist from initial migration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_feedback(
  p_question_id uuid,
  p_feedback    text
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_nodes  uuid[];
  v_nid    uuid;
BEGIN
  UPDATE questions
  SET feedback = p_feedback
  WHERE id = p_question_id
  RETURNING nodes_traversed INTO v_nodes;

  IF v_nodes IS NOT NULL THEN
    FOREACH v_nid IN ARRAY v_nodes LOOP
      IF p_feedback = 'thumbs_up' THEN
        UPDATE tree_nodes
        SET confidence = LEAST(confidence + 0.03, 0.99),
            updated_at = now()
        WHERE id = v_nid;
      ELSIF p_feedback = 'thumbs_down' THEN
        UPDATE tree_nodes
        SET confidence = GREATEST(confidence - 0.10, 0.10),
            updated_at = now()
        WHERE id = v_nid;
      END IF;
    END LOOP;
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. Reset daily ping counts (cron job — run via pg_cron or Supabase scheduler)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reset_ping_counts()
RETURNS void LANGUAGE sql AS $$
  UPDATE workspace_members SET ping_count_today = 0;
$$;
