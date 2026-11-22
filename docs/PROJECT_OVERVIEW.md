# Project overview

## Name

Abba Jifar Palace — Tour Booking and Visitor Management Website

## Purpose

Give Abba Jifar Palace, a historical heritage site in Jimma, Ethiopia, one website where visitors can book a tour and where palace staff can record who visits, who has booked, and whether a booking has been paid.

## Problem

Bookings, visitor records, and payment status are hard to run together when they live in separate notebooks, chats, or informal lists. Staff cannot see a single up-to-date picture of a visit, and visitors cannot reserve a tour through the palace’s own site.

## Target users

- **Visitors** who want to learn about the palace and book a tour.
- **Staff** who receive visitors, look up bookings, and record payment status.
- **Administrators** who manage tours, bookings, visitor records, payments, and user access.

## Objectives

- Run tour booking and visitor management in one maintainable website.
- Keep accounts and permissions on the server, with separate roles.
- Store bookings, visitors, and payments in a relational database.
- Stay within free, open-source tools that a small team can run locally.
- Reach a usable first version within about 24 hours of development.

## Scope

The repository had no separate requirements specification when this phase started. Scope below follows the agreed project brief.

**In scope**

- Public information about the palace and its tours.
- Accounts, sign-in, and role-based access.
- Tour booking.
- Visitor records linked to a visit.
- Payment status for a booking (recorded by staff, without a card-payment company).
- An administrative dashboard for those records.

**Later or left out of the first version**

- Card payments, bank APIs, and other paid third-party services.
- Email or SMS notifications.
- Afaan Oromo and Amharic translations.
- A native mobile app.
- More than one heritage site.
- External AI APIs.

## Key modules

| Module | What it is responsible for |
| --- | --- |
| Public site | Palace introduction and the list of tours a person can book |
| Accounts and access | Registration, sign-in, and roles |
| Bookings | Creating a booking and following its status |
| Visitors | Recording people who come for a visit |
| Payments | Recording the amount and whether it is unpaid or paid |
| Administration | Screens for staff and administrators to manage the records above |

Phase 1 prepares the environment, documentation, and a health check only. These modules are not implemented yet.
