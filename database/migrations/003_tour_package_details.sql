-- Details an administrator needs when describing a package.
-- Existing active and inactive rows stay valid. Archived is an additional status.

ALTER TABLE tour_packages DROP CONSTRAINT IF EXISTS tour_packages_status_check;

ALTER TABLE tour_packages
ADD CONSTRAINT tour_packages_status_check
CHECK (status IN ('active', 'inactive', 'archived'));

ALTER TABLE tour_packages
ADD COLUMN category text NOT NULL DEFAULT '',
ADD COLUMN included_activities text NOT NULL DEFAULT '',
ADD COLUMN max_group_size integer;

ALTER TABLE tour_packages
ADD CONSTRAINT tour_packages_category_check CHECK (length(category) <= 80),
ADD CONSTRAINT tour_packages_activities_check CHECK (length(included_activities) <= 2000),
ADD CONSTRAINT tour_packages_max_group_size_check CHECK (max_group_size IS NULL OR max_group_size > 0),
ADD CONSTRAINT tour_packages_price_limit_check CHECK (price_etb <= 1000000),
ADD CONSTRAINT tour_packages_duration_limit_check CHECK (duration_minutes <= 1440);

UPDATE tour_packages
SET
  category = 'History',
  included_activities = 'Guided walk through the palace halls',
  max_group_size = 20
WHERE name = 'Palace History Tour' AND category = '';

UPDATE tour_packages
SET
  category = 'Museum and garden',
  included_activities = 'Museum collections and the garden',
  max_group_size = 15
WHERE name = 'Museum and Garden Walk' AND category = '';

UPDATE tour_packages
SET
  category = 'Full visit',
  included_activities = 'History tour, museum, and garden',
  max_group_size = 12
WHERE name = 'Full Heritage Visit' AND category = '';
