-- ============================================================================
-- v2e correction: revert the Three Pillars display order back to the
-- original -- Draw Near to God first, Hear God second, Fulfill Your Kingdom
-- Mandate third. The prior "Hear God first" change (migration 11) was
-- incorrect per explicit user correction. Data-only, no schema change.
-- ============================================================================
update dp_pillars set order_index = 1 where code = 'draw_near';
update dp_pillars set order_index = 2 where code = 'hear_god';
update dp_pillars set order_index = 3 where code = 'fulfill_mandate';
