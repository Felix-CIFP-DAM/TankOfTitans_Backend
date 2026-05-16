# Especificación Técnica y Documentación del Proyecto: Tank of Titans

## 1. Introducción
Tank of Titans es un videojuego de estrategia táctica por turnos diseñado para entornos web. El sistema se apoya en una arquitectura distribuida de tres niveles que garantiza la escalabilidad, la separación de responsabilidades y la comunicación en tiempo real necesaria para una experiencia multijugador competitiva.

## 2. Arquitectura del Sistema
El ecosistema del proyecto se compone de tres microservicios interconectados que forman una pila tecnológica moderna.

### 2.1. Capa de Presentación (Frontend - Angular)
Desarrollada en Angular, esta capa es responsable de la renderización de la interfaz de usuario, la gestión de estados locales y la visualización del tablero de juego. Utiliza el motor de WebSockets para recibir actualizaciones reactivas del servidor sin necesidad de recargar la página.

### 2.2. Capa de Orquestación (Middleware - Node.js)
Actúa como un servidor de lógica de juego y puente de comunicación. Utiliza Socket.io para mantener conexiones persistentes con los clientes. Su función principal es gestionar las salas (lobbies), validar los movimientos de los jugadores en tiempo real y filtrar las peticiones antes de enviarlas a la API de persistencia.

### 2.3. Capa de Datos y Negocio (API Core - Java Spring Boot)
Es el núcleo del sistema, encargado de la lógica transaccional, la validación de reglas de negocio complejas, la gestión de la economía del juego (monedas, compras) y la persistencia en una base de datos relacional. Implementa seguridad basada en Spring Security y JWT.

---

## 3. Desglose de Componentes por Repositorio

### 3.1. TankOfTitans_API (Core en Java)
El backend de Spring Boot se organiza siguiendo el patrón de diseño MVC y Repository:

*   **Controllers**: Exponen la interfaz REST. Incluyen `AuthController` para gestión de sesiones, `AvatarController` para el catálogo de iconos, y `PartidaController` para el estado histórico de los juegos.
*   **Models/Entities**: Representan el esquema de la base de datos.
    *   `Usuario`: Almacena credenciales, estadísticas (victorias/derrotas) y saldo de monedas.
    *   `UsuarioAvatar`: Tabla de asociación que gestiona la propiedad de cosméticos.
    *   `Tanque`: Define las estadísticas base (HP, Defensa, Rangos) de cada unidad.
    *   `Partida`: Registro de sesiones de juego activas e históricas.
*   **Services**: Implementan la lógica pesada. Por ejemplo, `AuthServiceImpl` gestiona el registro y la asignación automática de activos iniciales a nuevos reclutas.
*   **Security**: Implementación de filtros JWT que interceptan cada petición para validar la identidad del middleware.

### 3.2. TankOfTitans_Backend (Lógica en Node.js)
El middleware se organiza por gestores de eventos (Handlers):

*   **Handlers**:
    *   `auth.handler.js`: Gestiona el flujo de login/registro entre el cliente y la API de Java.
    *   `lobby.handler.js`: Controla la creación de salas, el listado de partidas disponibles y la sincronización de jugadores antes del inicio.
    *   `game.handler.js`: (En desarrollo) Maneja la transmisión de coordenadas de movimiento y eventos de combate.
*   **Services**:
    *   `api.service.js`: Cliente HTTP (Axios) configurado con un token de superusuario para comunicarse de forma segura con la API de Spring Boot.
*   **Utils**:
    *   `UserManager.js`: Mapea los IDs de socket de Socket.io con los IDs de usuario de la base de datos, permitiendo el rastreo de sesiones ante desconexiones.

### 3.3. TankOfTitans_front (Capa de Presentación en Angular)
La arquitectura del frontend se basa en el ecosistema de Angular 17+, utilizando componentes de tipo 'Standalone' para reducir el acoplamiento y mejorar la modularización.

*   **Arquitectura de Componentes y Vistas**:
    *   **Dashboard y Gestión de Perfiles**: Los componentes como `PerfilUsuario` implementan una lógica reactiva donde los cambios en el modelo local se sincronizan bidireccionalmente con la vista mediante `ngModel` y se propagan al sistema mediante eventos `@Output`.
    *   **Gestión de Partidas (SalaHost/SalaUnirse)**: Implementan ciclos de vida de componente especializados (`ngOnInit`, `ngOnDestroy`) para gestionar la suscripción y desuscripción de flujos de datos en tiempo real, evitando fugas de memoria.
    *   **Motor de Interfaz de Juego (PartidaHUD/Tablero)**: Utiliza un sistema de posicionamiento dinámico y transformaciones CSS para permitir capacidades de 'Pan & Zoom' sobre el mapa de juego, garantizando una experiencia de usuario fluida incluso en tableros de gran escala.

*   **Capa de Servicios y Reactividad con RxJS**:
    *   **WebsocketService (Infraestructura de Red)**: Envuelve la librería `Socket.io-client` dentro de objetos `Observable`. Utiliza el servicio `NgZone` de Angular para asegurar que las actualizaciones recibidas desde el socket se ejecuten dentro del ciclo de detección de cambios de Angular, garantizando la consistencia visual inmediata.
    *   **DataService (Capa de Abstracción de Datos)**: Funciona como un orquestador de flujos. Implementa el patrón 'Subject' para convertir peticiones asíncronas en flujos de datos observables, permitiendo que múltiples componentes se suscriban a una única fuente de verdad sobre el estado de la conexión o los datos recibidos.
    *   **TalkerService (Notificaciones Transversales)**: Servicio centralizado para la gestión de feedback al usuario (éxitos, errores, advertencias) mediante un sistema de 'Toasts' dinámicos, desacoplando la lógica de negocio de la lógica de presentación de alertas.

*   **Modelado y Tipado Estricto**:
    *   **Directorio `modelos/`**: Contiene interfaces TypeScript (`Perfil.ts`, `Sala.ts`, `Tanque.ts`) que definen de forma estricta los contratos de datos esperados de la API. Esto garantiza la integridad de los datos durante la compilación y facilita el mantenimiento del código mediante el autocompletado y la detección temprana de errores.

*   **Persistencia de Sesión y Seguridad**:
    *   Implementación de interceptores de estado y gestión de `sessionStorage` para mantener la persistencia del token JWT, nickname y preferencias estéticas (iconos) entre recargas de página, asegurando una experiencia de usuario sin fricciones.

---

## 4. Protocolos y Flujos de Trabajo

### 4.1. Proceso de Autenticación y Sesión
1. El Cliente envía credenciales a través del middleware.
2. El Middleware solicita la validación a la API Java.
3. La API Java genera un token JWT y lo devuelve al Middleware.
4. El Middleware registra la sesión en su `UserManager` y envía el token al Cliente.
5. El Cliente almacena el token en `sessionStorage` y lo utiliza para autenticar futuras conexiones de Socket.

### 4.2. Sistema de Propiedad de Avatares
El sistema implementa un modelo de visualización condicional:
- Al solicitar la lista de avatares, la API cruza los datos de la tabla global con la tabla de propiedad del usuario específico.
- La respuesta incluye un flag booleano `comprado`.
- En el frontend, si `comprado` es falso, se aplica un filtro CSS de escala de grises y brillo reducido, además de bloquear la interacción.

---

## 5. Especificaciones Técnicas de Seguridad
*   **Encriptación**: Las contraseñas nunca se almacenan en texto plano, utilizando el algoritmo `BCrypt` con un factor de coste configurado.
*   **Validación de Middleware**: La API Java solo acepta peticiones de actualización de perfil o gestión de moneda si provienen del middleware autenticado, utilizando un sistema de tokens internos.
*   **Integridad de Datos**: Se utilizan transacciones de base de datos (`@Transactional`) para asegurar que la asignación de tanques y avatares iniciales sea atómica durante el registro.

---

## 6. Futuras Implementaciones y Escalabilidad
El proyecto está diseñado para crecer en las siguientes áreas:
*   **Editor de Mapas**: Integración de una herramienta visual para que los administradores definan terrenos y bases de jugadores.
*   **Sistema de Combate**: Lógica en el servidor Node.js para calcular el daño basado en las estadísticas de los tanques y la aleatoriedad controlada.
*   **Persistencia de Turnos**: Almacenamiento periódico del estado de la partida en Java para permitir la recuperación tras fallos del sistema.
