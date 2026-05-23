-- Migra datos no-cero de la tabla clásica calificaciones → calificaciones_items (fuente='en_curso')
INSERT INTO calificaciones_items (profesor_id, curso_id, estudiante_id, parcial, nombre_item, tipo, nota, fuente, updated_at)
SELECT profesor_id, curso_id, estudiante_id, parcial, nombre_item, 'tarea', nota, 'en_curso', NOW()
FROM (
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 1 AS parcial, COALESCE(c.nombres_tareas->>0,'ACD') AS nombre_item, cal.acd1 AS nota FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.acd1 IS NOT NULL AND cal.acd1 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 1, COALESCE(c.nombres_tareas->>1,'TA'), cal.ta1 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ta1 IS NOT NULL AND cal.ta1 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 1, COALESCE(c.nombres_tareas->>2,'PE'), cal.pe1 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.pe1 IS NOT NULL AND cal.pe1 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 1, COALESCE(c.nombres_tareas->>3,'EX'), cal.ex1 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ex1 IS NOT NULL AND cal.ex1 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 2, COALESCE(c.nombres_tareas->>0,'ACD'), cal.acd2 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.acd2 IS NOT NULL AND cal.acd2 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 2, COALESCE(c.nombres_tareas->>1,'TA'), cal.ta2 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ta2 IS NOT NULL AND cal.ta2 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 2, COALESCE(c.nombres_tareas->>2,'PE'), cal.pe2 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.pe2 IS NOT NULL AND cal.pe2 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 2, COALESCE(c.nombres_tareas->>3,'EX'), cal.ex2 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ex2 IS NOT NULL AND cal.ex2 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 3, COALESCE(c.nombres_tareas->>0,'ACD'), cal.acd3 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.acd3 IS NOT NULL AND cal.acd3 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 3, COALESCE(c.nombres_tareas->>1,'TA'), cal.ta3 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ta3 IS NOT NULL AND cal.ta3 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 3, COALESCE(c.nombres_tareas->>2,'PE'), cal.pe3 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.pe3 IS NOT NULL AND cal.pe3 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 3, COALESCE(c.nombres_tareas->>3,'EX'), cal.ex3 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ex3 IS NOT NULL AND cal.ex3 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 4, COALESCE(c.nombres_tareas->>0,'ACD'), cal.acd4 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.acd4 IS NOT NULL AND cal.acd4 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 4, COALESCE(c.nombres_tareas->>1,'TA'), cal.ta4 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ta4 IS NOT NULL AND cal.ta4 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 4, COALESCE(c.nombres_tareas->>2,'PE'), cal.pe4 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.pe4 IS NOT NULL AND cal.pe4 != 0
  UNION ALL
  SELECT c.profesor_id, cal.curso_id, cal.estudiante_id, 4, COALESCE(c.nombres_tareas->>3,'EX'), cal.ex4 FROM calificaciones cal JOIN cursos c ON c.id=cal.curso_id WHERE cal.ex4 IS NOT NULL AND cal.ex4 != 0
) AS datos
ON CONFLICT (curso_id, estudiante_id, parcial, nombre_item) DO UPDATE
  SET nota = EXCLUDED.nota, updated_at = NOW();
