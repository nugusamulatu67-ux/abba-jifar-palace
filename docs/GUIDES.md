# Guide assignment

An administrator assigns one guide to a departure. The guide then sees that departure, the booking references, and how many visitors are confirmed, checked in, or still expected.

Seed profiles that were created without a login stay in `guides`. New assignments are made only to a user whose role is tour guide.

## Who can do what

| Role | Allowed |
| --- | --- |
| Administrator | List guide accounts, assign, change, or remove a guide, and read assignment history |
| Tour guide | Read their own assignments and the visitors on those departures |
| Receptionist and tourist | No guide-assignment routes |

The administrator id is taken from the session. A guide cannot open another guide's assignment by changing the id in the address.

## Assignment rules

- The guide account is active and the role is tour guide.
- The departure is still `scheduled` and has not started.
- The departure does not already have an active guide. Changing it keeps the previous row.
- The guide is not already assigned to another departure whose time overlaps.
- A failed change leaves the current guide in place.

Confirmed visitors are the party sizes on bookings with status `confirmed`. Checked-in visitors are the party sizes on non-cancelled bookings that have a reception record. Still expected is the confirmed party that has not been checked in. Cancelled bookings are left out. Guides cannot see payment amounts or change bookings and check-ins.

Account status is shown on the guide list. This phase does not add a new way to activate or deactivate an account.
