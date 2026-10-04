-- Trolift Solutions — 0010 delivery partner priority
--
-- The delivery engine selects among serviceable options by
-- partner priority first, delivery charge second. Lower number wins;
-- equal priority falls back to the cheapest charge. Defaults keep
-- every existing partner equal (100) so current behaviour is unchanged
-- until Trolift configures real priorities.
--
-- Future extensions (per-pincode overrides, weight slabs, remote
-- surcharges) build on this column without touching the engine's
-- selection contract.

alter table public.delivery_partners
  add column priority integer not null default 100
  constraint delivery_partners_priority_check check (priority >= 0);

create index if not exists delivery_partners_priority_idx
  on public.delivery_partners (priority);
