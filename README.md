# Framework NFR - Evaluador de Requisitos No Funcionales

Este proyecto implementa el **Framework NFR**, una herramienta web desarrollada en Node.js que orquesta análisis de código estático (Mantenibilidad), escaneo dinámico de vulnerabilidades (Seguridad) y pruebas de carga (Rendimiento) utilizando contenedores Docker.

## Requisitos Previos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [Docker y Docker Compose](https://www.docker.com/) instalados y corriendo en el sistema.
- Git instalado (para la clonación de repositorios durante la evaluación de mantenibilidad).

## Instalación y Ejecución

1. **Levantar la Infraestructura (Docker):**
   Abre una terminal en la raíz del proyecto y ejecuta el siguiente comando para levantar SonarQube y su base de datos PostgreSQL:
   ```bash
   docker-compose up -d
   ```
   *Nota: SonarQube puede tardar 1-2 minutos en iniciar completamente. Puedes verificar que está corriendo ingresando a `http://localhost:9000` (Credenciales por defecto: admin / admin).*

2. **Instalar dependencias del Orquestador:**
   Ingresa al directorio `app` (donde reside el servidor Node.js) y ejecuta:
   ```bash
   cd app
   npm install
   ```

3. **Iniciar el Servidor Orchestrador:**
   Dentro de la carpeta `app`, ejecuta:
   ```bash
   npm start
   ```

4. **Acceder a la Aplicación:**
   Abre tu navegador web en [http://localhost:3000](http://localhost:3000).
   Las credenciales iniciales de acceso (Administrador) son:
   - **Usuario:** admin
   - **Contraseña:** nfr2026

## Arquitectura y Herramientas

El marco de trabajo automatiza y consolida resultados de las siguientes herramientas de código abierto:
- **Mantenibilidad:** SonarQube (Instanciado vía `docker-compose`)
- **Seguridad:** OWASP ZAP (Ejecutado dinámicamente vía Docker)
- **Rendimiento:** k6 de Grafana (Ejecutado dinámicamente vía Docker)

La persistencia de la aplicación se gestiona mediante **SQLite**, lo que evita la necesidad de configurar servidores de bases de datos relacionales adicionales para el historial del framework.
