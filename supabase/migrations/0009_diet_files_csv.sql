-- Permite adjuntar archivos CSV a los archivos de dieta (para poder leerlos y rellenar la dieta).
-- Es aditiva: solo amplía la lista de tipos permitidos del espacio de almacenamiento.
update storage.buckets
   set allowed_mime_types = array_append(allowed_mime_types, 'text/csv')
 where id = 'diet-files'
   and not ('text/csv' = any (allowed_mime_types));
