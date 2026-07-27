-- ============================================================================
-- v2b correction: fix Three Pillars display order to match the confirmed
-- correct sequence -- Hear God first, Draw Near to God second, Fulfill Your
-- Kingdom Mandate third (dp_pillars.order_index). Data-only change, no
-- schema change, no rollback entry needed beyond what already drops
-- dp_pillars entirely in ROLLBACK_dp_schema.sql.
-- ============================================================================

update dp_pillars set order_index = 1 where code = 'hear_god';
update dp_pillars set order_index = 2 where code = 'draw_near';
update dp_pillars set order_index = 3 where code = 'fulfill_mandate';
