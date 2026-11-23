-- Phase 7 tickets. A booking still has exactly one payment row.
-- Ticket tokens are unguessable. A valid ticket requires a paid, open booking.

CREATE TABLE tickets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id bigint NOT NULL UNIQUE REFERENCES bookings (id) ON DELETE RESTRICT,
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{32,80}$'),
  status text NOT NULL CHECK (status IN ('valid', 'void')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  CHECK (
    (status = 'valid' AND voided_at IS NULL)
    OR (status = 'void' AND voided_at IS NOT NULL)
  )
);

CREATE INDEX tickets_status_idx ON tickets (status);

CREATE FUNCTION tickets_require_paid_booking() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  booking_status text;
  payment_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'valid' THEN
    RETURN NEW;
  END IF;

  SELECT bookings.status, payments.status
  INTO booking_status, payment_status
  FROM bookings
  JOIN payments ON payments.booking_id = bookings.id
  WHERE bookings.id = NEW.booking_id;

  IF booking_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'ticket_booking_not_open'
      USING ERRCODE = '23514';
  END IF;

  IF payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'ticket_requires_payment'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tickets_require_paid_booking
BEFORE INSERT OR UPDATE OF status, booking_id ON tickets
FOR EACH ROW
EXECUTE FUNCTION tickets_require_paid_booking();

CREATE FUNCTION void_ticket_when_booking_cancelled() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE tickets
    SET status = 'void',
        voided_at = COALESCE(voided_at, now())
    WHERE booking_id = NEW.id
      AND status = 'valid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_void_ticket
AFTER UPDATE OF status ON bookings
FOR EACH ROW
EXECUTE FUNCTION void_ticket_when_booking_cancelled();

CREATE FUNCTION payments_reject_cancelled_booking() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  booking_status text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT status
  INTO booking_status
  FROM bookings
  WHERE id = NEW.booking_id;

  IF booking_status = 'cancelled' THEN
    RAISE EXCEPTION 'payment_booking_cancelled'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_reject_cancelled_booking
BEFORE INSERT OR UPDATE OF status ON payments
FOR EACH ROW
EXECUTE FUNCTION payments_reject_cancelled_booking();
