---
name: clima
description: Consulta el clima actual de Villa de Álvarez, Colima (México) de forma local, sin API key. Úsalo cuando el usuario pregunte por el clima, la temperatura, el pronóstico o "cómo está el tiempo" — la ciudad siempre es Villa de Álvarez, Colima.
---

# Clima — Villa de Álvarez, Colima

Este skill obtiene el clima **siempre** de la ciudad del usuario: **Villa de Álvarez, Colima, México**.
Usa el servicio público `wttr.in`, que no necesita API key ni credenciales.

## Cómo usarlo

Ejecuta el script incluido según lo que pida el usuario:

```bash
# Resumen de una línea (temperatura, sensación, condición, humedad, viento)
bash .claude/skills/clima/scripts/clima.sh

# Reporte detallado del día (mañana / tarde / noche)
bash .claude/skills/clima/scripts/clima.sh full

# Datos crudos en JSON (para extraer campos específicos)
bash .claude/skills/clima/scripts/clima.sh json
```

En Windows/PowerShell el comando `bash` está disponible (Git Bash). Si `curl` fallara,
como alternativa: `curl.exe -s "https://wttr.in/Villa+de+Alvarez,Colima?format=3&lang=es&m"`.

## Cómo reportar al usuario

1. Ejecuta `clima.sh` (modo `resumen` por defecto; usa `full` si piden pronóstico o detalle).
2. Muestra la temperatura en **°C** y el estado del clima en **español**.
3. Sé conciso: una tabla o un par de líneas basta.

## Notas

- La ciudad está fija a Villa de Álvarez, Colima — no la cambies salvo que el usuario
  pida explícitamente otra localidad.
- `wttr.in` refresca sus datos cada ~10–60 min; consultas muy seguidas darán el mismo valor.
- El flag `&m` fuerza sistema métrico (°C, km/h); `&lang=es` fuerza español.
