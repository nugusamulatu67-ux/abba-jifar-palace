-- Phase 8 check-in. One reception row is one arrival for one ticket.
-- Named visitor lines stay in visit_logs for a later phase.

ALTER TABLE receptions
ADD COLUMN ticket_id bigint UNIQUE REFERENCES tickets (id) ON DELETE RESTRICT;

CREATE INDEX receptions_arrived_at_idx ON receptions (arrived_at);

CREATE FUNCTION receptions_require_valid_ticket() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ticket_status text;
  ticket_booking bigint;
  booking_status text;
  payment_status text;
  schedule_status text;
  visit_day date;
BEGIN
  IF NEW.ticket_id IS NULL THEN
    RAISE EXCEPTION 'checkin_ticket_required'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    tickets.status,
    tickets.booking_id,
    bookings.status,
    payments.status,
    tour_schedules.status,
    (tour_schedules.starts_at AT TIME ZONE 'Africa/Addis_Ababa')::date
  INTO
    ticket_status,
    ticket_booking,
    booking_status,
    payment_status,
    schedule_status,
    visit_day
  FROM tickets
  JOIN bookings ON bookings.id = tickets.booking_id
  JOIN payments ON payments.booking_id = bookings.id
  JOIN tour_schedules ON tour_schedules.id = bookings.tour_schedule_id
  WHERE tickets.id = NEW.ticket_id;

  IF NOT FOUND OR ticket_booking IS DISTINCT FROM NEW.booking_id THEN
    RAISE EXCEPTION 'checkin_ticket_missing'
      USING ERRCODE = '23514';
  END IF;

  IF ticket_status IS DISTINCT FROM 'valid' THEN
    RAISE EXCEPTION 'checkin_ticket_void'
      USING ERRCODE = '23514';
  END IF;

  IF booking_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'checkin_booking_closed'
      USING ERRCODE = '23514';
  END IF;

  IF payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'checkin_unpaid'
      USING ERRCODE = '23514';
  END IF;

  IF schedule_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'checkin_schedule_closed'
      USING ERRCODE = '23514';
  END IF;

  IF visit_day IS DISTINCT FROM (now() AT TIME ZONE 'Africa/Addis_Ababa')::date THEN
    RAISE EXCEPTION 'checkin_wrong_date'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER receptions_require_valid_ticket
BEFORE INSERT ON receptions
FOR EACH ROW
EXECUTE FUNCTION receptions_require_valid_ticket();
