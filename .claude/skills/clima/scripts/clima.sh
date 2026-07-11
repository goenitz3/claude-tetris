#!/usr/bin/env bash
# Consulta el clima de Villa de Álvarez, Colima (México) usando wttr.in.
# No requiere API key ni dependencias más allá de `curl`.
#
# Uso:
#   ./clima.sh            -> resumen de una línea (por defecto)
#   ./clima.sh full       -> reporte detallado del día
#   ./clima.sh json       -> datos crudos en JSON (para procesar)
set -euo pipefail

CIUDAD="Villa+de+Alvarez,Colima"
MODO="${1:-resumen}"

case "$MODO" in
  resumen)
    curl -s --max-time 15 \
      "https://wttr.in/${CIUDAD}?format=%l:+%t+(sensacion+%f)+%c+%C,+humedad+%h,+viento+%w&lang=es&m"
    echo
    ;;
  full)
    # Vista compacta del día (hoy) en español y grados Celsius.
    curl -s --max-time 15 "https://wttr.in/${CIUDAD}?1&lang=es&m"
    ;;
  json)
    curl -s --max-time 15 "https://wttr.in/${CIUDAD}?format=j1"
    ;;
  *)
    echo "Modo desconocido: '$MODO'. Usa: resumen | full | json" >&2
    exit 1
    ;;
esac
