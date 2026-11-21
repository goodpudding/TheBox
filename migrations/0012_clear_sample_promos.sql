-- The live site read promo slides from sample files and refused every write,
-- so any row here came from the example seed. Promos are now read from this
-- table: start it empty so no sample slide reaches the lobby TV.
DELETE FROM "PromoSlide";
