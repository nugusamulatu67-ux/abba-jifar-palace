-- Phase 3 roles and server-side sessions.
-- Existing visitor accounts become tourists. Existing staff accounts become receptionists.

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_check;

UPDATE roles
SET
  name = 'tourist',
  description = 'Registers, signs in, and uses personal tourist services.'
WHERE name = 'visitor';

UPDATE roles
SET
  name = 'receptionist',
  description = 'Verifies bookings and checks visitors in.'
WHERE name = 'staff';

INSERT INTO roles (name, description)
VALUES
  ('administrator', 'Manages the system and staff accounts.'),
  ('tourist', 'Registers, signs in, and uses personal tourist services.'),
  ('tour_guide', 'Sees assigned tours and the visitors on those tours.'),
  ('receptionist', 'Verifies bookings and checks visitors in.')
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description;

ALTER TABLE roles
ADD CONSTRAINT roles_name_check
CHECK (name IN ('administrator', 'tourist', 'tour_guide', 'receptionist'));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_active_idx ON sessions (id) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION assert_active_staff(actor_id bigint) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  actor_role text;
BEGIN
  SELECT roles.name
  INTO actor_role
  FROM users
  JOIN roles ON roles.id = users.role_id
  WHERE users.id = actor_id
    AND users.status = 'active';

  IF actor_role IS NULL OR actor_role NOT IN ('receptionist', 'administrator') THEN
    RAISE EXCEPTION 'staff_actor_required'
      USING ERRCODE = '23514';
  END IF;
END;
$$;
