-- A public booking reference and cancellation facts.
-- Existing pending and confirmed rows stay valid. Cancelled rows must record when they were cancelled.

ALTER TABLE bookings
ADD COLUMN reference text,
ADD COLUMN cancelled_at timestamptz,
ADD COLUMN cancelled_by bigint REFERENCES users (id) ON DELETE SET NULL;

CREATE FUNCTION assign_booking_reference() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reference IS NULL OR btrim(NEW.reference) = '' THEN
    IF NEW.id IS NULL THEN
      NEW.reference := 'AJ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    ELSE
      NEW.reference := 'AJ-' || lpad(NEW.id::text, 6, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_assign_reference
BEFORE INSERT ON bookings
FOR EACH ROW
EXECUTE FUNCTION assign_booking_reference();

UPDATE bookings
SET reference = 'AJ-' || lpad(id::text, 6, '0')
WHERE reference IS NULL;

ALTER TABLE bookings
ALTER COLUMN reference SET NOT NULL;

ALTER TABLE bookings
ADD CONSTRAINT bookings_reference_format_check
CHECK (reference ~ '^AJ-[A-Z0-9]{6,12}$'),
ADD CONSTRAINT bookings_reference_key UNIQUE (reference),
ADD CONSTRAINT bookings_cancellation_check CHECK (
  (status = 'cancelled' AND cancelled_at IS NOT NULL)
  OR (status IN ('pending', 'confirmed') AND cancelled_at IS NULL AND cancelled_by IS NULL)
);
