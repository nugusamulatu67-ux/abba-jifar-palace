-- Initial schema for Abba Jifar Palace.
-- Booking rules enforced here:
--   * pending and confirmed bookings consume schedule capacity
--   * a tourist can have only one active booking per schedule
--   * a booking must receive its payment row in the same transaction

CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (name IN ('visitor', 'staff', 'administrator')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_id bigint NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  email text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' in email) > 1),
  password_hash text NOT NULL CHECK (length(password_hash) > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_role_id_idx ON users (role_id);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE tourists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  phone text,
  email text CHECK (email IS NULL OR (email = lower(email) AND position('@' in email) > 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tourists_set_updated_at
BEFORE UPDATE ON tourists
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE tour_packages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  description text NOT NULL,
  price_etb integer NOT NULL CHECK (price_etb >= 0),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tour_packages_set_updated_at
BEFORE UPDATE ON tour_packages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE tour_schedules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tour_package_id bigint NOT NULL REFERENCES tour_packages (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_capacity integer NOT NULL CHECK (max_capacity > 0),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tour_package_id, starts_at),
  CHECK (ends_at > starts_at)
);

CREATE INDEX tour_schedules_starts_at_idx ON tour_schedules (starts_at);

CREATE TRIGGER tour_schedules_set_updated_at
BEFORE UPDATE ON tour_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE guides (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint UNIQUE REFERENCES users (id) ON DELETE SET NULL,
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  phone text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER guides_set_updated_at
BEFORE UPDATE ON guides
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tourist_id bigint NOT NULL REFERENCES tourists (id) ON DELETE RESTRICT,
  tour_schedule_id bigint NOT NULL REFERENCES tour_schedules (id) ON DELETE RESTRICT,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_by bigint REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bookings_schedule_status_idx ON bookings (tour_schedule_id, status);

CREATE UNIQUE INDEX bookings_one_active_per_tourist_schedule
ON bookings (tourist_id, tour_schedule_id)
WHERE status IN ('pending', 'confirmed');

CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id bigint NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,
  amount_etb integer NOT NULL CHECK (amount_etb >= 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  method text NOT NULL CHECK (method IN ('cash', 'transfer')),
  recorded_by bigint REFERENCES users (id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'paid' AND paid_at IS NOT NULL)
    OR (status = 'unpaid' AND paid_at IS NULL)
  )
);

CREATE TRIGGER payments_set_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE guide_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tour_schedule_id bigint NOT NULL REFERENCES tour_schedules (id) ON DELETE RESTRICT,
  guide_id bigint NOT NULL REFERENCES guides (id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tour_schedule_id, guide_id)
);

CREATE INDEX guide_assignments_guide_id_idx ON guide_assignments (guide_id);

CREATE TABLE receptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id bigint NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,
  received_by bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE visit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reception_id bigint NOT NULL REFERENCES receptions (id) ON DELETE CASCADE,
  visitor_name text NOT NULL CHECK (length(btrim(visitor_name)) > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visit_logs_reception_id_idx ON visit_logs (reception_id);

CREATE TABLE visitor_feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id bigint NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_by bigint NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status = 'draft' AND published_at IS NULL)
  )
);

CREATE INDEX announcements_status_published_at_idx ON announcements (status, published_at);

CREATE TRIGGER announcements_set_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint REFERENCES users (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (length(btrim(action)) > 0),
  entity_type text NOT NULL CHECK (length(btrim(entity_type)) > 0),
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);

CREATE FUNCTION enforce_booking_capacity() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  schedule_capacity integer;
  schedule_status text;
  seats_taken integer;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT max_capacity, status
  INTO schedule_capacity, schedule_status
  FROM tour_schedules
  WHERE id = NEW.tour_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF schedule_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'booking_schedule_not_open'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(party_size), 0)
  INTO seats_taken
  FROM bookings
  WHERE tour_schedule_id = NEW.tour_schedule_id
    AND status IN ('pending', 'confirmed')
    AND id IS DISTINCT FROM NEW.id;

  IF seats_taken + NEW.party_size > schedule_capacity THEN
    RAISE EXCEPTION 'booking_capacity_exceeded'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_enforce_capacity
BEFORE INSERT OR UPDATE OF party_size, status, tour_schedule_id ON bookings
FOR EACH ROW
EXECUTE FUNCTION enforce_booking_capacity();

CREATE FUNCTION bookings_require_payment() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payments WHERE booking_id = NEW.id) THEN
    RAISE EXCEPTION 'booking_requires_payment'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER bookings_require_payment
AFTER INSERT ON bookings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION bookings_require_payment();

CREATE FUNCTION assert_active_staff(actor_id bigint) RETURNS void
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

  IF actor_role IS NULL OR actor_role NOT IN ('staff', 'administrator') THEN
    RAISE EXCEPTION 'staff_actor_required'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION assert_reception_staff() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_active_staff(NEW.received_by);
  RETURN NEW;
END;
$$;

CREATE FUNCTION assert_payment_recorder() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recorded_by IS NOT NULL THEN
    PERFORM assert_active_staff(NEW.recorded_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER receptions_require_staff
BEFORE INSERT OR UPDATE OF received_by ON receptions
FOR EACH ROW
EXECUTE FUNCTION assert_reception_staff();

CREATE TRIGGER payments_require_staff_recorder
BEFORE INSERT OR UPDATE OF recorded_by ON payments
FOR EACH ROW
EXECUTE FUNCTION assert_payment_recorder();
