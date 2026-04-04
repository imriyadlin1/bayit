-- Optional: instant permission updates in the app (otherwise polling ~18s still applies)
-- Run in Supabase SQL Editor if Realtime is enabled on your project.

ALTER PUBLICATION supabase_realtime ADD TABLE member_permissions;
