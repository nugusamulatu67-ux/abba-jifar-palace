-- One active primary guide per departure, with earlier assignments kept.

ALTER TABLE guide_assignments
  ADD COLUMN assigned_by bigint REFERENCES users (id) ON DELETE RESTRICT,
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'removed')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN closed_at timestamptz,
  ADD CONSTRAINT guide_assignments_closed_at_check CHECK (
    (status = 'active' AND closed_at IS NULL)
    OR (status IN ('replaced', 'removed') AND closed_at IS NOT NULL)
  );

CREATE UNIQUE INDEX guide_assignments_one_active_schedule
  ON guide_assignments (tour_schedule_id)
  WHERE status = 'active';

CREATE TRIGGER guide_assignments_set_updated_at
BEFORE UPDATE ON guide_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE FUNCTION guide_assignments_validate_active() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  departure tour_schedules%ROWTYPE;
  account_status text;
  account_role text;
  guide_status text;
  guide_user bigint;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.closed_at := NULL;

  SELECT * INTO departure FROM tour_schedules WHERE id = NEW.tour_schedule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_schedule_missing' USING ERRCODE = '23503';
  END IF;

  IF NEW.assigned_by IS NOT NULL THEN
    IF departure.status <> 'scheduled' OR departure.starts_at <= now() THEN
      RAISE EXCEPTION 'assignment_schedule_closed' USING ERRCODE = '23514';
    END IF;

    SELECT users.status, roles.name, guides.status, guides.user_id
      INTO account_status, account_role, guide_status, guide_user
    FROM guides
    LEFT JOIN users ON users.id = guides.user_id
    LEFT JOIN roles ON roles.id = users.role_id
    WHERE guides.id = NEW.guide_id;

    IF guide_user IS NULL
      OR account_role IS DISTINCT FROM 'tour_guide'
      OR account_status IS DISTINCT FROM 'active'
      OR guide_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'assignment_guide_unavailable' USING ERRCODE = '23514';
    END IF;

    PERFORM 1
    FROM users
    JOIN roles ON roles.id = users.role_id
    WHERE users.id = NEW.assigned_by
      AND roles.name = 'administrator'
      AND users.status = 'active';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'assignment_actor_required' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM guide_assignments existing
    JOIN tour_schedules existing_departure ON existing_departure.id = existing.tour_schedule_id
    WHERE existing.guide_id = NEW.guide_id
      AND existing.status = 'active'
      AND existing.id IS DISTINCT FROM NEW.id
      AND existing.tour_schedule_id <> NEW.tour_schedule_id
      AND existing_departure.starts_at < departure.ends_at
      AND departure.starts_at < existing_departure.ends_at
  ) THEN
    RAISE EXCEPTION 'assignment_overlap' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guide_assignments_validate_active
BEFORE INSERT OR UPDATE OF status, guide_id, tour_schedule_id, assigned_by, closed_at
ON guide_assignments
FOR EACH ROW
EXECUTE FUNCTION guide_assignments_validate_active();
