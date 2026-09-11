-- Same Heart -- Email gifting
-- Lets a gift code be tied to the email it was sent to, so a giver can
-- see who they gifted something to. Safe to re-run.

alter table gift_codes add column if not exists recipient_email text;
