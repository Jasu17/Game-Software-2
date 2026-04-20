# Space Invaders – JavaScript & HTML5

Juego de naves tipo Space Invaders desarrollado en JavaScript vanilla con HTML5 Canvas,
mejorado como parte del taller de Ingeniería de Software 2 (UIS).

## Cómo ejecutar

Abrir `naves.html` en un navegador moderno (Chrome, Firefox o Safari).
No requiere servidor ni dependencias externas.

## Controles

| Tecla       | Acción                  |
|-------------|-------------------------|
| `←` `→`    | Mover la nave           |
| `Espacio`   | Disparar                |
| `P`         | Pausar / Reanudar       |

## Estructura del proyecto
```
├── naves.html
├── css/
│   ├── reset.css
│   └── main.css
├── js/
│   ├── config.js      # Configuración y estado global
│   ├── utils.js       # Utilidades generales
│   ├── entities.js    # Jugador, enemigos y proyectiles
│   ├── sounds.js      # Sistema de sonido
│   ├── renderer.js    # Renderizado en canvas
│   ├── scores.js      # Puntuaciones (localStorage)
│   └── game.js        # Loop y lógica principal
└── images/            # Sprites del juego
```

## Características implementadas

- 3 tipos de enemigos con comportamientos distintos (normal, rápido, zigzag)
- Jefe final con 2 fases y embestidas laterales
- Sistema de vidas, puntuación y high score persistente
- Dificultad seleccionable (Fácil / Normal / Difícil)
- Tutorial interactivo por pasos antes de iniciar
- Efectos de sonido procedurales (Web Audio API)
- 3 temas visuales aplicados en toda la interfaz
- Menú principal accesible desde pausa y fin de partida
- Nombre del jugador registrado en el ranking

## Sonidos

Los sonidos se generan por código. Para reemplazarlos por archivos locales,
consultar las instrucciones en `js/sounds.js`.

## Tecnologías

- JavaScript (arquitectura modular basada en patrones clásicos)
- HTML5 Canvas (render loop manual)
- Web Audio API (síntesis procedural de sonido)
- localStorage (persistencia de ranking)
