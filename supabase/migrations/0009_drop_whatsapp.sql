-- Trolift Solutions — 0009 remove WhatsApp automation
--
-- Product-scope change: Trolift is a B2B ordering platform. Automated
-- messaging is out of scope, so whatsapp_leads and whatsapp_messages go
-- away. Core commerce tables (profiles, customers, products,
-- delivery_partners, delivery_pincode_rates, orders, order_items,
-- payments) are untouched.
--
-- DROP TABLE also removes the tables' indexes, triggers and RLS
-- policies. Verified: no remaining migration, seed row or application
-- query references either table (leads/messages were outbound-only;
-- nothing FK-references them).

drop table if exists public.whatsapp_messages;
drop table if exists public.whatsapp_leads;
