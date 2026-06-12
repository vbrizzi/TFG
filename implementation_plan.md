# Plan de Implementación del Sistema Completo (Framework NFR)

## Descripción del Objetivo
El objetivo es intentar construir el **sistema completo y funcional** propuesto en la tesis. En lugar de simular los procesos, implementaremos el orquestador real en Node.js que se encargará de levantar y coordinar contenedores Docker reales (SonarQube, OWASP ZAP y k6), extraer sus métricas, consolidarlas en una base de datos relacional y exponerlas en un Frontend interactivo. 

Si por cuestiones de tiempo o recursos de tu PC esto resulta demasiado pesado en las etapas finales, siempre podremos reciclar el código desarrollado y crear la "Demo Simulada" usando la interfaz gráfica y la lógica matemática.

## User Review Required / Preguntas Abiertas
> [!WARNING]
> **Requisitos de Hardware:** Ejecutar SonarQube, OWASP ZAP, Node.js y bases de datos al mismo tiempo en contenedores Docker es **bastante intensivo** en memoria RAM (mínimo recomendado: 8GB a 16GB RAM libres). ¿Tu computadora puede soportar esta carga para probar el proyecto localmente?
> 
> **Dependencias:** Para seguir este plan vas a necesitar tener instalado **Docker y Docker Compose** en tu PC, además de Node.js. ¿Los tenés instalados?

## Propuesta de Arquitectura (Full)

1. **Infraestructura (Docker Compose):**
   - **SonarQube** (+ PostgreSQL): Para el análisis estático de código fuente.
   - **OWASP ZAP:** Contenedor oficial para realizar los escaneos de vulnerabilidades dinámicos.
   - **k6:** Contenedor temporal (se levanta on-demand) para ejecutar scripts de carga.
2. **Backend (Node.js + Express):**
   - Servidor orquestador que clona repositorios, dispara comandos Docker, y consolida reportes (JSON).
   - **Base de Datos (SQLite):** Para guardar el historial de evaluaciones, aplicaciones registradas y puntajes (cumpliendo RF10 y RF13). Es ideal porque no requiere instalar otro motor pesado.
3. **Motor de Scoring:** Algoritmo que lee los JSON crudos de SonarQube, ZAP y k6 y aplica fórmulas de normalización.
4. **Frontend (Dashboard):** Interfaz web con Chart.js para ver la evolución gráfica.
5. **Generador PDF (Puppeteer):** Servicio backend para emitir reportes formales.

## Cambios Propuestos (Etapas de Desarrollo)

Dividiremos el desarrollo en 4 hitos lógicos:

### Fase 1: Base de Datos y Servidor Base (Orquestador)
- `docker-compose.yml`: Archivo para instanciar la infraestructura (SonarQube).
- `package.json` y `server.js`: Estructura inicial del servidor Express.
- `database.js` / Prisma (o similar): Configuración de SQLite con las tablas `Aplicacion`, `Configuracion` y `Evaluacion`.

### Fase 2: Integración de Herramientas Reales
- `services/sonarService.js`: Script de Node.js que descarga el código de un repo Git y lanza el contenedor `sonar-scanner`.
- `services/zapService.js`: Script que ejecuta el escaneo baseline de Docker ZAP contra una URL objetivo.
- `services/k6Service.js`: Script que arma un archivo de carga `load.js` y ejecuta el contenedor de k6, guardando el reporte.

### Fase 3: Motor de Normalización
- `services/evaluator.js`: Procesa la salida de los tres servicios, convierte la deuda técnica, tiempos de respuesta y criticidad de vulnerabilidades en métricas 0-100 y calcula el "Índice General de Calidad".

### Fase 4: Frontend y Reportes
- `public/`: Diseño del Dashboard (HTML, CSS y App.js + Chart.js).
- `services/pdfService.js`: Integración de Puppeteer para descargar el PDF de la evaluación.

## Plan de Verificación

1. **Infraestructura:** Levantar `docker-compose up` y verificar acceso a `localhost:9000` (SonarQube).
2. **Evaluación Real:** Inscribir un repositorio público de prueba (ej. una app tuya o algo simple en Github), ejecutar la evaluación real y comprobar que los tres contenedores se accionan secuencialmente.
3. **Persistencia:** Revisar la base SQLite para verificar que el historial queda guardado.

### Fase 5: Corrección de Bugs y Pulido UX/UI (Actual)

En base a la revisión detallada de la interfaz y la integración con el backend, abordaremos las siguientes mejoras en este orden sugerido:

#### 0. Respaldo y Restricción de Diseño Visual (CRÍTICO)
- **Backup de Referencia:** Guardar una copia exacta de `index.html`, `styles.css` y `app.js` actuales para asegurar que el diseño original no se pierda.
- **Mantener Identidad Visual:** Cualquier elemento nuevo (dropdowns, tablas dinámicas, logins) deberá mantener estrictamente los colores, tipografías, tarjetas y estilos de la interfaz de referencia presentada en etapas previas de la tesis.

#### 1. Limpieza de Interfaz y Detalles Menores
- **Limpieza visual:** Eliminar todos los textos de "casos de uso" (Ej: "CU-05", etc.) de todas las pantallas.
- **Mejora del Log:** Aumentar el tamaño del cuadro de logs en la pestaña de ejecución.
- **Botón Imprimir:** Conectar el botón "Imprimir" del reporte a la función nativa del navegador.

#### 2. Flujo Completo de Aplicaciones (Backend + Frontend)
- **Registrar App:** Conectar el formulario de registro con la API real para insertar aplicaciones en la BD.
- **Selectores Dinámicos:** Reemplazar los campos de texto estáticos por "dropdowns" (listas desplegables) en el "Dashboard", "Configurar Evaluación", "Ejecutar Evaluación" y "Resultados" para que lean las aplicaciones registradas desde la base de datos.
- **Estado de Configuración:** En "Configurar Evaluación", verificar visualmente si se tienen todos los datos necesarios para cada prueba funcional seleccionada (URL, repositorio, parámetros).
- **Integración de Autenticación:** Agregar una pantalla o flujo de Login real en lugar de entrar directamente como administrador.

#### 3. Ejecución y Monitoreo en Tiempo Real
- **Selección de Herramientas:** En "Ejecutar Evaluación", permitir activar o desactivar qué pruebas (Sonar, ZAP, k6) se correrán antes de lanzar la evaluación.
- **Tarjetas de Estado:** Conectar las tarjetas visuales de SonarQube, ZAP y k6 (que actualmente dicen "Pendiente") para que se actualicen en base al progreso de la ejecución.

#### 4. Integración de Resultados Reales y PDF Consistente
- **Carga de Datos Reales:** Conectar los gráficos del Dashboard y la pantalla de Resultados a los datos consolidados en SQLite.
- **Reporte Consistente:** Ajustar la vista de "Reportes" en la web para que muestre datos reales y modificar la plantilla de `pdfService.js` (Puppeteer) para que el PDF descargado sea consistente con lo que se visualiza en la pantalla web.
- **Validación con la Tesis:** Contrastar las funciones implementadas con el documento de la tesis para detectar discrepancias u omisiones.

> [!TIP]
> **Pregunta para el usuario:** Este es el orden de ataque propuesto. ¿Estás de acuerdo con arrancar primero por la Limpieza visual (Paso 1) y luego avanzar con la conexión de formularios y selectores (Paso 2)?
