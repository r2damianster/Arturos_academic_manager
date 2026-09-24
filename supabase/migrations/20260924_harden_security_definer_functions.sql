-- Endurece funciones SECURITY DEFINER expuestas vía /rest/v1/rpc (advisor Supabase 0028/0029).
-- Verificado contra los rpc() reales de src/ el 2026-09-24. NO se toca is_admin() (la usan políticas RLS),
-- check_student_email, consume_action_token ni get_occupied_slots (flujos previos al login / por token).

-- 1) Funciones de trigger o internas que la app nunca llama por RPC: nadie debe ejecutarlas por la API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vincular_estudiante_al_registrarse()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activar_estudiantes_faltantes()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_horas_tutoria(uuid, double precision) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_unreported_tutorias()               FROM PUBLIC, anon, authenticated;

-- 2) RPC que exigen sesión iniciada: quitar acceso anónimo, mantener authenticated.
REVOKE EXECUTE ON FUNCTION public.acumular_horas_tutoria_semana(uuid, uuid, date, double precision) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_mi_reserva(integer)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_problemas_estudiante(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gestionar_reserva_profesor(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_encuestas_parciales_pendientes(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_reemplazante_info(text)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.inicializar_horarios_profesor(uuid)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marcar_no_asistire(integer)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reservar_tutoria(integer, text, text, text, text, uuid, text, date, text, text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.acumular_horas_tutoria_semana(uuid, uuid, date, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_mi_reserva(integer)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_problemas_estudiante(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.gestionar_reserva_profesor(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_encuestas_parciales_pendientes(text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reemplazante_info(text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.inicializar_horarios_profesor(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_no_asistire(integer)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_tutoria(integer, text, text, text, text, uuid, text, date, text, text, integer, integer) TO authenticated;

-- 3) search_path fijo (advisor 0011)
ALTER FUNCTION public.check_unique_grupo_sesion()        SET search_path = public;
ALTER FUNCTION public.activar_estudiantes_faltantes()    SET search_path = public;
ALTER FUNCTION public.clear_problemas_estudiante(uuid)   SET search_path = public;
ALTER FUNCTION public.vincular_estudiante_al_registrarse() SET search_path = public;
ALTER FUNCTION public.increment_horas_tutoria(uuid, double precision) SET search_path = public;
ALTER FUNCTION public.acumular_horas_tutoria_semana(uuid, uuid, date, double precision) SET search_path = public;
ALTER FUNCTION public.get_reemplazante_info(text)        SET search_path = public;
ALTER FUNCTION public.get_encuestas_parciales_pendientes(text) SET search_path = public;
