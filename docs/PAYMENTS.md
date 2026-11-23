# Payment and ticket rules

A booking already has one payment row, created unpaid when the tourist reserves seats. This phase records that the palace received the money. It does not call a card or mobile-money service.

The stored methods are `cash` and `transfer`. Bank transfer uses `transfer`. The schema has no third method and no `refunded` status, so this phase does not add them.

## Who can do what

| Role | Allowed |
| --- | --- |
| Tourist | Read the payment and ticket for their own booking. They cannot mark it paid. |
| Receptionist | Search a booking and record one payment received at the palace. |
| Administrator | List, filter, inspect, and record payments. The detail page shows the audit entries for that booking. |
| Tour guide | No payment routes. |

The server reads the signed-in user from the session. A user id or amount in the request body is ignored.

## Recording a payment

The amount is the package price times the party size, calculated on the server. Recording runs in one database transaction:

1. Lock the booking and its payment row.
2. Reject a cancelled booking and a booking that is already paid.
3. Set the existing payment row to `paid`, with the method, the server amount, the staff user, and the time.
4. Insert one valid ticket.
5. Write audit rows for `payment.record` and `ticket.issue`.

If the ticket insert fails, the payment update is rolled back. The booking stays unpaid and has no ticket. Recording the same booking again returns an error and does not create a second ticket.

An unpaid row keeps the placeholder method `cash` required by the original table. The API hides that method until the payment is actually recorded.

## Tickets

A ticket token is 32 random bytes, encoded so it is safe in a URL. The QR code contains only the palace verification address for that token. It does not contain a name, email, password, session, or payment credential.

The public check returns the palace name, booking reference, tour, time, party size, and whether the ticket is valid. One booking has one ticket row. A valid ticket requires a pending or confirmed booking whose payment is `paid`.

There is no refund status. If a paid booking is later cancelled under the booking rules, the database marks that ticket `void`. The payment row stays `paid` so the receipt is not deleted. A void ticket does not scan as valid, and a cancelled booking cannot be paid.

## What this phase does not do

Visitor check-in and scanning the QR code at the desk are a later phase. Cancelling a paid booking does not calculate a refund.
