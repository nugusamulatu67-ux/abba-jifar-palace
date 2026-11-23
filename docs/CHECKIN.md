# Reception check-in

A receptionist checks in a paid party on the day of the visit. Scanning a QR code and typing a booking reference use the same rules. Neither one records an arrival until the receptionist confirms it.

The public ticket page still shows only whether a ticket is valid. It does not show the visitor’s name or payment method.

## Who can do what

| Role | Allowed |
| --- | --- |
| Receptionist | Preview a ticket, check in an eligible party, and read check-in history |
| Administrator | Read check-in history and the daily attendance summary. The history page does not edit or delete rows |
| Tourist and tour guide | No check-in routes |

The receptionist id is taken from the session. A user id in the request body is ignored.

## When a ticket can be checked in

All of these must be true, and they are checked again inside the database transaction:

- The ticket exists and is `valid`.
- The booking is pending or confirmed, not cancelled.
- The payment is `paid`.
- The departure is still `scheduled`.
- No arrival has been recorded for that booking.
- The scheduled date in Africa/Addis_Ababa is today. Visitors may arrive early or late on that date. Another date is rejected.

The arrival is one `receptions` row for the whole party. The visitor count stays on the booking. Booking status and payment status do not change. A second attempt finds the unique booking and ticket link and does not insert another row.

A successful check-in writes `visitor.checkin` to the audit log with the booking reference, ticket id, party size, and time. The QR token is not stored there. A rejected attempt writes no check-in audit row.
