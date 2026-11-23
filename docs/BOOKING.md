# Booking rules

A tourist booking reserves seats on one scheduled departure. The price is the package price times the number of visitors. The server calculates that total. The browser cannot set the price or the tourist.

Payment is not collected in this phase. Creating a booking also stores the unpaid payment row the database already requires. That row stays `unpaid`. Nothing in this phase marks a booking paid.

## Status

| Status | Meaning | Who can set it |
| --- | --- | --- |
| `pending` | Seats are held. The palace has not confirmed the reservation. | Created this way for every new tourist booking |
| `confirmed` | An administrator has accepted the reservation. Payment is still due at the palace. | Administrator, and only from `pending`, while the departure is still upcoming and scheduled |
| `cancelled` | The reservation is kept for history and no longer holds seats. | Tourist or administrator, from `pending` or `confirmed` |

There is no path back from `cancelled`. Confirming a booking does not change the payment row.

## Cancellation

The project requirements do not give a cancellation deadline. This phase uses one rule:

- A tourist can cancel their own `pending` or `confirmed` booking until the departure starts.
- An administrator can cancel a `pending` or `confirmed` booking that has no reception record, including after the start time.
- A booking that already has a reception record cannot be cancelled here.
- Cancelling again does nothing. Seats are released only on the change into `cancelled`.

## Capacity

`pending` and `confirmed` bookings count toward `tour_schedules.max_capacity`. `cancelled` bookings do not. The booking request locks the schedule row, checks the seats still open, and inserts the booking and its unpaid payment in that same transaction. The database trigger locks the schedule again and rejects a party that would pass the capacity.
