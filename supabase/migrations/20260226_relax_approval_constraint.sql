-- Relax approval_consistency constraint to allow system approvals
-- The approve endpoint is called from an unauthenticated email link,
-- so approved_by_user_id may be null for system-approved topics

ALTER TABLE custom_topics DROP CONSTRAINT approval_consistency;

ALTER TABLE custom_topics ADD CONSTRAINT approval_consistency CHECK (
  (status = 'approved' AND approved_at IS NOT NULL) OR
  (status IN ('pending', 'rejected') AND approved_at IS NULL AND approved_by_user_id IS NULL)
);
