-- Rollback for migration 0029. NOT run automatically.
-- Removes only the Worship Development draft shell (modules, lessons and any
-- blocks/progress cascade). The Voice Studio area, the vocal-coaching program and
-- the four vocal courses are left exactly as they are.
begin;
delete from dp_courses where slug = 'worship-development';
commit;
