/**
 * config.js
 * Constantes de configuración del juego y objeto de estado global compartido.
 * Todos los módulos leen/escriben sobre el objeto `GameState`.
 */

/* ─── Constantes de configuración ─────────────────────────────────────────── */
var CONFIG = {
    /* Jugador */
    PLAYER_LIFE      : 3,
    PLAYER_SPEED     : 5,
    SHOT_SPEED       : 5,
    SHOT_DELAY_MS    : 250,

    /* Enemigos base */
    EVIL_SPEED       : 1,
    EVIL_LIFE        : 3,
    EVIL_SHOTS       : 5,
    TOTAL_EVILS      : 7,

    /* Jefe final */
    BOSS_LIFE        : 12,
    BOSS_SHOTS       : 30,

    /* Dificultad (RP 030) */
    DIFFICULTY_STEP  : 0.15,

    /* Movimiento horizontal de enemigos */
    MIN_H_OFFSET     : 100,
    MAX_H_OFFSET     : 400,

    /* Puntuaciones */
    BEST_SCORES_COUNT: 5,

    /* Teclas */
    KEY_LEFT  : 37,
    KEY_RIGHT : 39,
    KEY_FIRE  : 32,
    KEY_PAUSE : 80,

    /**
     * Definición de niveles.
     * Cada nivel tiene un array de oleadas; cada oleada es un array de tipos
     * de enemigo que aparecen en sucesión rápida (WAVE_ENEMY_DELAY ms entre c/u).
     * El último nivel contiene la oleada del jefe.
     * bonusPoints: puntos extra otorgados al completar el nivel.
     */
    LEVELS : [
        {
            id          : 1,
            label       : 'Nivel 1',
            bonusPoints : 20,
            waves       : [
                ['normal'],
                ['normal']
            ]
        },
        {
            id          : 2,
            label       : 'Nivel 2',
            bonusPoints : 35,
            waves       : [
                ['normal', 'fast']
            ]
        },
        {
            id          : 3,
            label       : 'Nivel 3',
            bonusPoints : 50,
            waves       : [
                ['fast', 'zigzag']
            ]
        },
        {
            id          : 4,
            label       : 'Nivel 4',
            bonusPoints : 70,
            waves       : [
                ['zigzag', 'zigzag']
            ]
        },
        {
            id          : 5,
            label       : 'Jefe Final',
            bonusPoints : 0,
            waves       : [
                ['boss']
            ]
        }
    ],

    /* ms entre la aparición de cada enemigo dentro de una misma oleada */
    WAVE_ENEMY_DELAY  : 1400,
    /* ms de pausa entre oleadas del mismo nivel */
    WAVE_PAUSE        : 3000,
    /* ms de pausa entre niveles (durante la pantalla de transición) */
    LEVEL_PAUSE       : 2200
};

/* ─── Estado global del juego ──────────────────────────────────────────────── */
var GameState = {
    /* Canvas y contextos */
    canvas    : null,
    ctx       : null,
    buffer    : null,
    bufferctx : null,

    /* Entidades principales */
    player : null,
    evil   : null,

    /* Imágenes de sprites */
    images : {
        bgMain        : new Image(),
        bgBoss        : new Image(),
        playerShot    : new Image(),
        evilShot      : new Image(),
        playerKilled  : new Image(),
        evilFrames    : [],   // 8 frames de animación del enemigo
        evilKilled    : new Image(),
        bossFrames    : [],   // 8 frames de animación del jefe
        bossKilled    : new Image()
    },

    /* Buffers de proyectiles */
    playerShotsBuffer : [],
    evilShotsBuffer   : [],

    /* Contadores y progresión */
    evilCounter          : 1,
    totalEvils           : CONFIG.TOTAL_EVILS,
    difficultyMultiplier : 1.0,

    /* Progresión por niveles y oleadas */
    currentLevelIndex : 0,   // índice en CONFIG.LEVELS
    currentWaveIndex  : 0,   // índice de oleada dentro del nivel actual
    enemyInWaveIndex  : 0,   // índice del enemigo dentro de la oleada actual
    activeEnemies     : [],  // enemigos vivos simultáneamente en pantalla
    showingLevelScreen: false, // pantalla de transición entre niveles

    /* Flags de estado de pantalla */
    showingStartScreen  : true,   // RP 022: pantalla de inicio
    showingInstructions : false,  // RP 027
    showingOptions      : false,  // RP 024: menú de opciones
    paused              : false,  // RP 006
    youLoose            : false,
    congratulations     : false,
    endOverlayShown     : false,  // RP 001/026: evita re-crear el overlay en cada frame

    /* Control de disparo del jugador (RP 018/028) */
    nextPlayerShot  : 0,

    /* Mensaje flotante de recompensa (RP 019) */
    rewardMessage : null,  // { text, x, y, timer, alpha }

    /* RP 004: partículas de impacto */
    impactParticles : [],  // [{ x, y, vx, vy, life, maxLife, color }]

    /* Snapshot del enemigo actual para reiniciar nivel (RP 017) */
    currentEvilSnapshot : null,

    /* RP 006: IDs de setTimeout activos, para cancelarlos al pausar */
    activeTimeouts : [],

    /* RP 010: nombre del jugador */
    playerName : '',

    /* RP 011: configuración de sonido y tema visual */
    soundEnabled  : true,          // toggle on/off
    visualTheme   : 'default',     // 'default' | 'neon' | 'retro'

    /* RP 024: dificultad seleccionada (0=Fácil, 1=Normal, 2=Difícil) */
    selectedDifficulty : 1
};

/* ─── Timer pausable ───────────────────────────────────────────────────────── */
/**
 * Reemplaza setTimeout con un wrapper que registra el ID.
 * Permite cancelar todos los timers activos al pausar el juego.
 * @param {Function} fn
 * @param {number}   delay  ms
 * @returns {number} ID del timeout
 */
function gameSetTimeout(fn, delay) {
    var id = setTimeout(function () {
        var idx = GameState.activeTimeouts.indexOf(id);
        if (idx !== -1) GameState.activeTimeouts.splice(idx, 1);
        fn();
    }, delay);
    GameState.activeTimeouts.push(id);
    return id;
}

/**
 * Cancela todos los timeouts registrados (al pausar o reiniciar).
 */
function clearAllTimeouts() {
    for (var i = 0; i < GameState.activeTimeouts.length; i++) {
        clearTimeout(GameState.activeTimeouts[i]);
    }
    GameState.activeTimeouts = [];
}