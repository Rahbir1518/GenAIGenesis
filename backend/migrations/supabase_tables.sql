CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE workspaces (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  slug          text UNIQUE NOT NULL,
  owner_id      text NOT NULL, -- Clerk user ID
  github_repo   text,
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id          text NOT NULL, -- Clerk user ID
  role             text NOT NULL CHECK (role IN ('admin', 'engineer', 'sales', 'viewer')),
  display_name     text NOT NULL,
  github_username  text,
  slack_id         text,
  ping_count_today int NOT NULL DEFAULT 0,
  joined_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE agents (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type               text NOT NULL CHECK (type IN ('sales', 'engineering', 'custom')),
  name               text NOT NULL,
  extraction_prompt  text NOT NULL,
  domain_scope       text[] NOT NULL DEFAULT '{}',
  last_scan_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel            text NOT NULL, -- 'general' | 'agent:{uuid}' | 'bot_dm:{user_id}'
  sender_id          uuid REFERENCES workspace_members(id) ON DELETE SET NULL,
  content            text NOT NULL,
  extracted_context  jsonb,
  processed          boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tree_nodes (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id       uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  parent_id      uuid REFERENCES tree_nodes(id) ON DELETE CASCADE,
  node_type      text NOT NULL CHECK (node_type IN ('domain', 'module', 'owner_leaf')),
  label          text NOT NULL,
  summary        text NOT NULL,
  embedding      vector(1536),
  owner_id       uuid REFERENCES workspace_members(id) ON DELETE SET NULL,
  confidence     float NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source         text NOT NULL CHECK (source IN ('pr', 'chat', 'manual', 'bot_answer')),
  source_ref     uuid, -- FK to messages.id or a pr record
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW tree_nodes_with_staleness AS
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

CREATE TABLE questions (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asked_by             uuid NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
  question_text        text NOT NULL,
  classified_domains   text[] NOT NULL DEFAULT '{}',
  question_type        text CHECK (question_type IN ('capability', 'status', 'ownership', 'comparison', 'urgent')),
  nodes_traversed      uuid[] NOT NULL DEFAULT '{}',
  answer_text          text,
  confidence_score     float CHECK (confidence_score >= 0 AND confidence_score <= 1),
  was_routed           boolean NOT NULL DEFAULT false,
  routed_to            uuid REFERENCES workspace_members(id) ON DELETE SET NULL,
  feedback             text CHECK (feedback IN ('thumbs_up', 'thumbs_down')),
  urgency              text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'high', 'critical')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE analytics_daily (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date           date NOT NULL,
  auto_answered  int NOT NULL DEFAULT 0,
  routed         int NOT NULL DEFAULT 0,
  hours_saved    float NOT NULL DEFAULT 0,
  top_domains    jsonb NOT NULL DEFAULT '[]',
  UNIQUE (workspace_id, date)
);

CREATE INDEX ON workspace_members(workspace_id);
CREATE INDEX ON workspace_members(user_id);

CREATE INDEX ON agents(workspace_id);

CREATE INDEX ON messages(workspace_id, channel, created_at DESC);
CREATE INDEX ON messages(processed) WHERE processed = false;

CREATE INDEX ON tree_nodes(agent_id);
CREATE INDEX ON tree_nodes(owner_id);
CREATE INDEX ON tree_nodes(parent_id);

CREATE INDEX ON tree_nodes USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX ON questions(workspace_id, created_at DESC);
CREATE INDEX ON questions(asked_by);
CREATE INDEX ON questions(was_routed) WHERE was_routed = true;

CREATE INDEX ON analytics_daily(workspace_id, date DESC);

CREATE OR REPLACE FUNCTION reset_ping_counts()
RETURNS void LANGUAGE sql AS $$
  UPDATE workspace_members SET ping_count_today = 0;
$$;

CREATE OR REPLACE FUNCTION apply_feedback(
  p_question_id uuid,
  p_feedback    text  -- 'thumbs_up' | 'thumbs_down'
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
END;
$$;

CREATE OR REPLACE FUNCTION upsert_tree_node(
  p_agent_id   uuid,
  p_parent_id  uuid,
  p_node_type  text,
  p_label      text,
  p_summary    text,
  p_embedding  vector(1536),
  p_owner_id   uuid,
  p_confidence float,
  p_source     text,
  p_source_ref uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM tree_nodes
  WHERE agent_id = p_agent_id AND label = p_label
  LIMIT 1;
 
  IF v_id IS NOT NULL THEN
    UPDATE tree_nodes SET
      summary    = p_summary,
      embedding  = p_embedding,
      owner_id   = COALESCE(p_owner_id, owner_id),
      confidence = p_confidence,
      source     = p_source,
      source_ref = p_source_ref,
      updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO tree_nodes
      (agent_id, parent_id, node_type, label, summary, embedding, owner_id, confidence, source, source_ref)
    VALUES
      (p_agent_id, p_parent_id, p_node_type, p_label, p_summary, p_embedding, p_owner_id, p_confidence, p_source, p_source_ref)
    RETURNING id INTO v_id;
  END IF;
 
  RETURN v_id;
END;
$$;

ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tree_nodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily   ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_member(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.jwt() ->> 'sub'
  );
$$;

CREATE OR REPLACE FUNCTION member_role(p_workspace_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.jwt() ->> 'sub'
  LIMIT 1;
$$;

CREATE POLICY "members can read workspace"
  ON workspaces FOR SELECT
  USING (is_member(id));
 
CREATE POLICY "owner can update workspace"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.jwt() ->> 'sub');

CREATE POLICY "members can read member list"
  ON workspace_members FOR SELECT
  USING (is_member(workspace_id));

CREATE POLICY "members can update own row"
  ON workspace_members FOR UPDATE
  USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "members can read agents"
  ON agents FOR SELECT
  USING (is_member(workspace_id));
 
CREATE POLICY "admins can manage agents"
  ON agents FOR ALL
  USING (member_role(workspace_id) = 'admin');

CREATE POLICY "members can read messages"
  ON messages FOR SELECT
  USING (is_member(workspace_id));
 
CREATE POLICY "members can insert messages"
  ON messages FOR INSERT
  WITH CHECK (is_member(workspace_id));

CREATE POLICY "members can read tree nodes"
  ON tree_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id AND is_member(a.workspace_id)
    )
  );
 
CREATE POLICY "engineers and admins can update tree nodes"
  ON tree_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
        AND member_role(a.workspace_id) IN ('engineer', 'admin')
    )
  );

CREATE POLICY "members can read questions"
  ON questions FOR SELECT
  USING (is_member(workspace_id));
 
CREATE POLICY "members can insert questions"
  ON questions FOR INSERT
  WITH CHECK (is_member(workspace_id));
 
CREATE POLICY "admins can read analytics"
  ON analytics_daily FOR SELECT
  USING (member_role(workspace_id) = 'admin');

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE tree_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_daily;