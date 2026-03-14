-- 1. Create the table
CREATE TABLE IF NOT EXISTS github_pull_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    github_node_id TEXT UNIQUE NOT NULL,
    pr_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    author_username TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
    diff_url TEXT NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_prs_workspace_id ON github_pull_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_github_prs_node_id ON github_pull_requests(github_node_id);

-- 3. Enable RLS
ALTER TABLE github_pull_requests ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy (Assumes is_member function exists)
CREATE POLICY "members can read github pull requests"
    ON github_pull_requests FOR SELECT
    USING (is_member(workspace_id));

-- 5. Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE github_pull_requests;

-- 6. Add Auto-update for 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_github_prs_updated_at
    BEFORE UPDATE ON github_pull_requests
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();