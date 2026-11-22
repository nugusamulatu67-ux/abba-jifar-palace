# System requirements

## Source

The repository contained no requirements document before Phase 1. This file records the requirements from the agreed project brief: a tour booking and visitor management website for Abba Jifar Palace in Jimma, with authentication, role-based access, a relational database, bookings, visitor records, payments, and an administrative dashboard.

The working assumptions in the next section fill gaps the brief did not name. Confirm or correct them before feature work starts. They are not silent changes to a previous specification.

## Working assumptions

Confirm these before Phase 2:

1. The site serves one place: Abba Jifar Palace in Jimma.
2. Three roles are enough: Visitor, Staff, and Administrator.
3. The first version is in English.
4. Prices are in Ethiopian birr (ETB).
5. A payment is a status on a booking (unpaid or paid), recorded by staff. The first version does not call a payment gateway. That matches the decision to avoid paid services during the 24-hour build.
6. A visitor record is a person attached to a booking, so staff can see who a booking is for.

## User roles

| Role | Responsibilities |
| --- | --- |
| Visitor | Create an account, read tour information, create a booking, and see their own bookings and payment status. |
| Staff | Look up bookings, record the people for a visit, and update payment status. |
| Administrator | Do the staff tasks, and manage users, roles, and tours from the dashboard. |

A person who is not signed in can read public tour information. Creating a booking requires an account.

## Functional requirements

- **FR-1.** A visitor can register and sign in.
- **FR-2.** The server allows each action only for roles that are permitted to perform it.
- **FR-3.** A visitor can read a short introduction to the palace and a list of tours, including price.
- **FR-4.** A signed-in visitor can create a booking for a tour, a visit date, and a party size.
- **FR-5.** A visitor can see only their own bookings.
- **FR-6.** Staff and administrators can see bookings.
- **FR-7.** Staff and administrators can record one or more visitors on a booking.
- **FR-8.** Staff and administrators can record the amount and payment status of a booking.
- **FR-9.** Administrators can create, update, and deactivate tour listings.
- **FR-10.** Administrators can assign the Visitor, Staff, or Administrator role to an account.
- **FR-11.** The dashboard shows bookings, visitor records, and payment status for staff and administrators.

## Non-functional requirements

- **NFR-1.** Permission checks run on the server. Hiding a button in the browser is not enough.
- **NFR-2.** Passwords are stored only as hashes.
- **NFR-3.** Secrets and machine-specific settings live in environment variables. `.env` stays out of Git. `.env.example` contains placeholders only.
- **NFR-4.** The team can install and run the website with free, open-source software and no external AI API.
- **NFR-5.** The website works in current Chrome, Edge, and Firefox.
- **NFR-6.** The folder structure and code stay understandable for developers who are still learning.
- **NFR-7.** The first delivery fits about 24 hours of development, so each phase implements one slice of the requirements above.

## Constraints

- **C-1.** One heritage site, not a platform for many sites.
- **C-2.** Relational data in PostgreSQL. See [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).
- **C-3.** No paid services and no external AI APIs.
- **C-4.** Phase 1 stops after the environment, documentation, and a health check. Booking, authentication, payments, and dashboards are later phases.
- **C-5.** The existing Git repository is kept. Generated dependencies and secrets are not committed.
