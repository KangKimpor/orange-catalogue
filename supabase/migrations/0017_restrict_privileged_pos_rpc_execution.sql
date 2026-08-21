-- POS imports and import-history rebuilds are initiated only by authenticated Orange
-- admin actions on the application server. Keep these SECURITY DEFINER procedures
-- callable by the server's service-role client, never by public REST RPC roles.

REVOKE ALL ON FUNCTION public.apply_pos_import(integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_pos_import(integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.apply_pos_import(integer, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pos_import(integer, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.remove_pos_import_and_rebuild(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_pos_import_and_rebuild(integer) FROM anon;
REVOKE ALL ON FUNCTION public.remove_pos_import_and_rebuild(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.remove_pos_import_and_rebuild(integer) TO service_role;

REVOKE ALL ON FUNCTION public.rollback_pos_import(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rollback_pos_import(integer) FROM anon;
REVOKE ALL ON FUNCTION public.rollback_pos_import(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_pos_import(integer) TO service_role;
