-- Sincroniza el curso FILOSOFÍA, EPISTEMOLOGÍA Y SOCIOLOGÍA DE LA EDUCACIÓN (fese262a, 2026-2)
-- con la lista oficial de Moodle (43 estudiantes). Producción: hxsnyrutyyavvljxwgku.
do $$
declare
  v_curso uuid := '3409c0a6-d716-490b-a6ca-3b437be3494e';
  v_prof uuid := '6d3391b6-68da-4127-a424-aa8a88b2a785';
  v_retirado_sin_datos uuid := 'dfa16749-d0ed-40b5-b137-4708d73c6979'; -- e1315493369@
  eliminados int;
begin
  -- 1. Nombres según Excel (formato "Nombres Apellidos")
  update estudiantes set nombre = 'Gibelly Nicolle Lucas Marcillo' where curso_id = v_curso and email = 'e1314181338@live.uleam.edu.ec';
  update estudiantes set nombre = 'Bryan Joshue Macias Pico'       where curso_id = v_curso and email = 'e1316612553@live.uleam.edu.ec';
  update estudiantes set nombre = 'Maria Pia Carreño Moreira'      where curso_id = v_curso and email = 'e1317677118@live.uleam.edu.ec';
  update estudiantes set nombre = 'Devanys Paola Roman Macias'     where curso_id = v_curso and email = 'e1351234958@live.uleam.edu.ec';

  -- 2. Retiros legalizados (no están en la lista oficial). Hijos se borran por ON DELETE CASCADE.
  delete from estudiantes
  where curso_id = v_curso
    and estado = 'retirado'
    and email in ('sinregistro.luis.pin@pendiente.local', 'sinregistro.mirka.jimenez@pendiente.local');
  get diagnostics eliminados = row_count;
  if eliminados <> 2 then raise exception 'se esperaban 2 eliminados, fueron %', eliminados; end if;

  -- 3. Retirado sin legalizar: completar "Ausente" en las sesiones cumplidas que le faltan
  insert into asistencia (profesor_id, curso_id, estudiante_id, fecha, semana, estado, atraso, horas, bitacora_id)
  select v_prof, v_curso, v_retirado_sin_datos, b.fecha, b.semana, 'Ausente', false, '0.0', b.id
  from bitacora_clase b
  where b.curso_id = v_curso
    and b.estado = 'cumplido'
    and not exists (select 1 from asistencia a where a.estudiante_id = v_retirado_sin_datos and a.fecha = b.fecha);

  -- 4. Verificación
  if (select count(*) from estudiantes where curso_id = v_curso) <> 43 then raise exception 'total != 43'; end if;
  if (select count(*) from asistencia where estudiante_id = v_retirado_sin_datos) <> 9 then raise exception 'asistencia del retirado != 9'; end if;
end $$;
