# Tesis Brizzi Victor Emmanuel (Versión Humanizada con Cambios en Cursiva)

## Titulo
Modelo Automatizado De Evaluación Continua De Requerimientos No Funcionales

## Introducción
*Este trabajo propone desarrollar* un framework automatizado para evaluar requerimientos no funcionales en aplicaciones de software, integrando herramientas de análisis y utilizando métricas objetivas. *El propósito es generar* indicadores cuantificables y reportes estandarizados que ofrezcan una mirada integral del estado general de un sistema, agilizando la toma de decisiones durante su ciclo de desarrollo.

## Antecedentes
En ingeniería de software, la calidad de los sistemas ya no recae únicamente en el cumplimiento de la funcionalidad, sino que depende directamente de atributos como el rendimiento, la seguridad, la usabilidad y la mantenibilidad. Estas características están formalmente estandarizadas bajo el modelo ISO/IEC 25010 para la evaluación de productos de software.

*Aun así, este tipo de requerimientos presenta* complicaciones específicas al momento de validarlos. Según señala Sommerville (2011), suelen ser bastante más difíciles de verificar empíricamente que los requerimientos funcionales, provocando un gran margen de ambigüedad durante su implementación a lo largo del proceso general de desarrollo.

En la práctica, evaluar estos atributos se posterga hacia las últimas etapas del ciclo, a veces probándose directamente en producción. Esto dispara el riesgo de fallos críticos y costos de retrabajo. *Al respecto*, Forsgren, Humble y Kim (2018) señalan que si se logran incorporar prácticas de calidad tempranas dentro del flujo de desarrollo, se garantiza una mayor estabilidad en el sistema de manera preventiva.

*A menudo*, los análisis quedan delegados a herramientas especializadas muy segmentadas: una para rendimiento, otra independiente para seguridad y otra aislada para el código base. La principal desventaja es que esta fragmentación impide que los equipos técnicos tengan una lectura consolidada sobre la calidad real de la aplicación, dificultando el seguimiento general.

*De frente a este problema*, las filosofías contemporáneas como Site Reliability Engineering (Ingeniería de Confiabilidad del Sitio) insisten en la medición constante para garantizar sistemas robustos (Beyer et al., 2016). *Queda en evidencia entonces la necesidad* de avanzar hacia una solución que integre estas verificaciones de manera continua, automatizada y fundamentada por métricas, sustituyendo el chequeo aislado actual.

## Descripción del área problemática
*Hoy en día*, los equipos técnicos precisan métricas claras y precisas sobre la calidad de sus productos. Ya no alcanza con que un sistema "haga lo que debe hacer"; resulta crucial comprobar que su rendimiento y su nivel de seguridad soportarán escenarios de producción sin degradación, dado el fuerte impacto que tienen en el usuario final.

*Pese a esto*, la práctica habitual en las organizaciones muchas veces relega este análisis o bien lo introduce con herramientas sueltas e independientes, que carecen de una vía para consolidar resultados. *Como resultado*, la información de auditoría aparece desperdigada. Frente a reportes desconectados, los equipos dedican un esfuerzo manual considerable para llegar a una conclusión general, basándose en la cruza mental de variables y la experiencia del líder técnico del proyecto en vez de indicadores sólidos.

*También existe una falta importante de* seguimiento sistemático, lo que a menudo invisibiliza problemas progresivos. Surgen inconvenientes por no poder contrastar cómo era el sistema el mes pasado frente a los errores del presente; no se logran trazar tendencias de mejoría o percibir una regresión de la calidad hasta que ocurre una falla notoria. *Surge entonces la urgencia de contar con* herramientas estructuradas de centralización orientadas 100% a la toma de decisiones rápidas y respaldadas por datos medibles.

## Justificación
*Este proyecto nació de la necesidad generalizada de* mejorar la forma en que se evalúan los requerimientos no funcionales. El hecho de monitorear el rendimiento o la mantenibilidad siempre demandaba recurrir a herramientas inconexas, que volvían prácticamente imposible consolidar un panorama fiel del producto de software bajo análisis. 

*Para resolver esto*, el proyecto buscó cubrir la necesidad de una plataforma automatizada, continua y, sobre todo, estandarizada. Incorporando esto al desarrollo del código diario, fue posible detectar puntos de alerta de manera preventiva, bajando drásticamente el impacto de lanzar problemas graves al entorno de producción de los usuarios y nivelando hacia arriba la vida útil general del código.

*A nivel tecnológico, la propuesta aportó* un sistema unificado de scoring (o puntajes) capaz de condensar todos los valores aislados en indicadores simples, trazables en una línea de tiempo. Esto se desmarcó de la perspectiva tradicional, centrada en solucionar anomalías puntuales sin tener en cuenta la salud conjunta del proyecto.

*El valor principal de la investigación radicó* justamente en entregar una fuente única y confiable de métricas. Con información objetiva, se logran ciclos de desarrollo mucho más pulidos y se evita encarecer los costos de reparaciones tardías. 

*El resultado es una innovación procedimental clara* sobre cómo interactúan los equipos de calidad (QA). Se permitió la transformación de todo el testeo no funcional en algo activo, ininterrumpido y basado en analítica fuerte; moviendo a todo el equipo desde una reacción post-incidencia a un control proactivo de la evolución de su trabajo.

## Objetivo General Del Proyecto
Desarrollar un framework automatizado para la evaluación de requerimientos no funcionales en aplicaciones de software, basado en la ejecución de pruebas y el uso de métricas objetivas, que permita generar reportes estandarizados con indicadores cuantificables.

## Objetivos específicos del proyecto
*   Definir un conjunto de métricas objetivas para la evaluación de requerimientos no funcionales en las categorías de mantenibilidad, seguridad y rendimiento.
*   Diseñar un modelo de evaluación que permita integrar, normalizar y analizar los resultados obtenidos a partir de herramientas automatizadas.
*   Implementar un mecanismo de cálculo de puntajes que permita cuantificar el nivel de cumplimiento de los requerimientos no funcionales evaluados.
*   Desarrollar un prototipo funcional que permita ejecutar pruebas automatizadas, procesar los resultados y generar reportes estandarizados.
*   Validar el funcionamiento del framework mediante la aplicación del prototipo en un caso de estudio.

## Marco Teórico Referencial

### 1. Dominio del problema
*Dentro de la ingeniería de software actual*, los requerimientos no funcionales representan aquellos atributos del sistema que no operan cara a cara con el usuario, pero dictaminan la longevidad y el éxito de la herramienta a nivel técnico. El estándar ISO/IEC 25010 describe estos conceptos en dimensiones de calidad tales como el grado de seguridad, el rendimiento o la capacidad de mantenimiento del propio código fuente.

*Varios autores remarcan que estos atributos* son extremadamente complicados de establecer con metas numéricas u objetivas, por lo que quedan bajo la libre interpretación (Chung et al., 2000). Esta falta de rigurosidad responde a que abarcan a toda la plataforma a un nivel transversal; el rendimiento, por ejemplo, depende tanto de la respuesta del código, del flujo de base de datos como de la arquitectura escogida de servidores en general.

*A nivel industrial, estas evaluaciones suelen hacerse mediante* paquetes de carga masiva de peticiones o análisis de escáner en las últimas versiones publicadas. Esto provoca un choque conceptual y, hasta la fecha, sigue evidenciando la falencia del mercado de tener un parámetro claro en esta amalgama técnica. *Frente a esta fragmentación, resulta necesario* un protocolo de unificación de criterios, con métricas centralizadas, agilizando el entendimiento sobre el estado completo del desarrollo informático al cual se aplique (Bass, Clements & Kazman, 2012).

### 2. Tecnologías de la Información y la Comunicación (TIC)

#### 2.1 Herramientas de evaluación
A fin de resolver la recolección de los datos, el desarrollo se sustenta con utilidades open-source líderes:
*   Para auditar el estado del código base y la mantenibilidad, se configurará **SonarQube**, capaz de trazar posibles refactorizaciones y "olores de código" (code smells).
*   En torno de las garantías de blindaje, se dispondrá de **OWASP ZAP**, una suit fundamental del testeo y prevención de inyecciones y huecos funcionales, operando contra aplicaciones de entorno web.
*   En base al consumo general y validación de picos de operación, **k6** permitirá el armado de una carga parametrizada robusta para estresar la red y recabar la capacidad real del procesamiento.

#### 2.2 Tecnologías de desarrollo
La base del proyecto está escrita sobre el entorno Node.js, apalancándose en su arquitectura no bloqueante; idóneo para procesos paralelos en lote que se demandarán para este perfil automatizado propuesto. La comunicación central operará mediante intercambio REST/JSON estándar de ecosistema.
Toda la suite estará contenida sobre instancias Docker, erradicando los famosos conflictos "en mi máquina sí funciona" e incentivando despliegues rápidos en la nube si fuese necesario. A la par, el historial del progreso evaluador será soportado en motores de almacenamiento transaccional que guardarán cada iteración.

#### 2.3 Generación de reportes
Para la interfaz, se requerirá a Chart.js dar vida a los números recolectados a partir de resúmenes amigables. *En paralelo, se incorporará Puppeteer* para asegurar un servicio fluido capaz de imprimir todos los dashboards gráficos del HTML analizado en reportes formales PDF portables listos para auditorías directas.

### 3. Competencia
Hoy en el mercado predominan las soluciones puntuales y separadas. De forma unitaria, plataformas destacadas como SonarQube, orientada al código, o k6 focalizado completamente en medir los márgenes de uso de las API resuelven áreas específicas de manera excepcional, mas operan un único pilar del proyecto planteado.
*Si bien existen opciones como Google Lighthouse, que generan reportes* consolidados rápidos de rendimiento, en general sus alcances resultan más enfocados a una meta SEO (Search Engine Optimization) y al impacto del cliente en pantalla. 

Por ende, este trabajo encuentra su lugar justamente al no poseer en la actualidad una solución que haga de amalgama sobre estos reportes fragmentados, sumando una métrica cuantificable universal.

## Diseño Metodológico

### 1. Herramientas metodológicas y de desarrollo
Para orquestar todo lo necesario entre tecnologías diversas, se recurrió a herramientas clave.
En la parte backend predominará Node.js para las ejecuciones en simultáneo. Se lo vinculará al cliente web por la tecnología de API estandarizada de hoy con archivos tipo JSON. Todo el set transitará por instancias Docker.

El uso de SonarQube, OWASP ZAP y k6 oficiará como columna de inspección técnica pura para cubrir calidad interna, barreras de intromisión y testeo físico de límites. Una vez que se consumen, la librería Chart.js modelará la información para presentarse visualmente amena y entendible a usuarios externos al equipo de programación, y *se apoyará también en Puppeteer* para que, a partir de esto se genere con facilidad y sin dependencia externa el material físico (en formato .PDF).

Todo este esfuerzo recaerá en el paradigma del marco metodológico Scrum. Las divisiones de desarrollo y recolección van a ir tomando parte por ciclos limitados para generar mejoras demostrables paso a paso en caso de revisión a mitad del marco universitario propuesto o ajuste del docente a futuro.

### 2. Recolección de datos
La estrategia de toma de material tomará datos fácticos, tanto en etapa de literatura teórica como así en una investigación vivencial sobre el campo al someter aplicaciones propias frente al testeo planificado por el prototipo del sistema.

*Primero se realizará* recolección profunda bajo lineamientos como ISO/IEC 25010 y documentación académica oficial disponible para entender con profundidad la teoría en la exigencia de atributos modernos; un tema tan recurrente hoy que muta rápidamente tras los parámetros que Google u otros imponen al mercado.

*Luego, se procederá con* un rastrillaje funcional, recolectando y midiendo la propuesta contra el abanico en oferta y qué logran abarcar plataformas como la mencionada aquí, y sobre qué variables son mejores, en qué fracasan, sus API gratuitas u operaciones limitadas frente a su contraoferta de pago. 

*Por último, la validación se hará a través de* someter a programas construidos al abanico experimental y recoger si los datos y gráficos concuerdan de forma lógica, concluyente, y real, verificando su comportamiento durante las etapas del test.

### 3. Planificación del proyecto
Para administrar la evolución natural, se fijó el control sobre una carta o diagrama Gantt que marcará metas semanales/mensuales bajo estas categorías preestablecidas:
I. Selección de la temática
II. Definición del problema
III. Justificación del proyecto
IV. Definición del objetivo general
V. Definición de los objetivos específicos
VI. Investigación inicial sobre requerimientos no funcionales y estándares de calidad
VII. Desarrollo del marco teórico referencial
VIII. Definición de tecnologías y herramientas (TIC)
IX. Diseño metodológico
X. Relevamiento de la situación actual (estructura y procesos)
XI. Modelado de procesos de negocio
XII. Elaboración del diagrama de Gantt
XIII. Revisión y ajustes finales

*Las actividades quedan divididas en cuatro etapas* de proyecto desde nivel conceptual a niveles más formales de desarrollo informático y de base.

## Relevamiento

### 1. Relevamiento estructural
Para situar en un ejemplo tangible este problema, y puesto que no hay un convenio de prestación comercial o de pasantía vigente en una firma local, el ejemplo será en base al marco general bajo un modelo estándar (o "modelo base del rubro"), algo bastante habitual en entornos informáticos locales para este tipo de emprendimientos de test de software. De esta manera podemos trazar su accionar general con exactitud, que está englobado en:

*   Se usará en entornos paralelos controlados de testing y de preproducción.
*   En los respectivos depósitos control de código online
*   En túneles prearmados (CI/CD) o pipeline.
*   Desplegado en staging para prueba rápida

*A su vez, los equipos* funcionarán con la asiduidad estándar de uso de git, herramientas automáticas de mensajería (Slack, Trello) y el despliegue automático del rubro local.

### 2. Relevamiento funcional
A falta de estructura societaria directa en este punto del caso de negocio inventado, el perfil de roles de los evaluadores estará basado en lineamientos de software conocidos como son:

#### 2.1 Roles identificados
*   **Desarrollador:** implementador de bases y funcionalidad técnica del código.
*   **Tester o control de Calidad (QA):** supervisor directo del correcto funcionamiento en etapas liminares al traspaso de producción.
*   **Arquitecto o DevOps:** el integrador o armador central de red y que dictamina los niveles técnicos al test o las modificaciones.

#### 2.2 Funciones
*   Desarrollar plataformas web.
*   Verificar los requerimientos puntuales propuestos inicialmente de código / no código del software
*   Inyectar ese progreso o revisión por las canaletas continuas hacia los testeos del servidor.
*   Ver la analítica de puntajes que el sistema les devuelve para decidir cambios cruciales de forma temprana.

### 3. Procesos relevados
*   **Nombre del proceso:** Evaluación actual de nivel físico y abstracto (situación de mercado actual pre-lanzamiento)
*   **Participantes en juego:** Roles habituales

#### Pasos actuales:
Un equipo convencional sube modificaciones diarias de código. Dicha actualización vuela rápidamente a los servidores estáticos de la intranet a través de contenedores al pasarlo a estado "Testing". El grupo general QA ingresa, da unas aprobaciones estándar y se percata de funcionamiento por test automatizados puramente "lógicos" (ingreso, contraseñas, vista al cliente). 

*Esporádicamente, algunos miembros* aplican testeadores web externos para observar fugas de seguridad menores, o algún scan del mismo IDE por defectos de formato. Esa auditoría, al hacerse a mano, es una captura suelta del momento. Sin haber protocolos definidos para reportes o consolidarlo al equipo en un número base a aprobar y superar, la toma de decisión para escalar su producto depende de a qué le prestaron atención aquel día a puro olfato técnico, en desmedro claro de errores futuros imperceptibles bajo el escenario anterior.

### 4. Relevamiento de documentación
Hoy el circuito cuenta de manera genérica con un marco bibliográfico dispar:
*   Planillas web descontextualizadas del "code check".
*   Fojas extensas del scan de brechas devueltas.
*   Listados del registro Log en sistemas a demanda y temporario sobre testeos masivos sin un comparador directo al período de mes previo.

## Procesos de negocio
**Evaluación actual de requerimientos no funcionales**
Este proceso de revisión inicial demuestra el abismo en el seguimiento métrico y analítico constante en una compañía que recién conforma calidad; con demasiada herramienta especializada dando una fracción independiente en reportes cruzados que consumen enormemente la resolución si no se automatizan a un informe de resultados consolidados de rápido procesamiento, lo que el proyecto prevé abarcar y subsanar rápidamente.

## Referencias
*   Bass, L., Clements, P., & Kazman, R. (2012). Software architecture in practice (3rd ed.). Addison-Wesley.
*   Beyer, B., Jones, C., Petoff, J., & Murphy, N. R. (2016). Site reliability engineering: How Google runs production systems. O’Reilly Media.
*   Chung, L., Nixon, B., Yu, E., & Mylopoulos, J. (2000). Non-functional requirements in software engineering. Springer.
*   Fenton, N., & Bieman, J. (2014). Software metrics: A rigorous and practical approach (3rd ed.). CRC Press.
*   Forsgren, N., Humble, J., & Kim, G. (2018). Accelerate: The science of lean software and DevOps. IT Revolution Press.
*   International Organization for Standardization. (2011). ISO/IEC 25010...
*   International Organization for Standardization. (2013). ISO/IEC/IEEE 29119 software testing standard. ISO.
*   Kim, G., Humble, J., Debois, P., & Willis, J. (2016). The DevOps handbook. IT Revolution Press.
*   Sommerville, I. (2011). Software engineering (9th ed.). Pearson.
