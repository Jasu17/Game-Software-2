/**
 * entities.js
 * Define todas las entidades del juego:
 *   - Shot (base) → PlayerShot, EvilShot
 *   - Enemy (base) → Evil, EvilFast, EvilZigzag, FinalBoss
 *   - Player
 *
 * Depende de: utils.js, config.js
 */

/* ══════════════════════════════════════════════════════════
   DISPAROS
   ══════════════════════════════════════════════════════════ */

/**
 * Clase base para proyectiles (jugador y enemigo).
 * @param {number} x      Posición inicial X
 * @param {number} y      Posición inicial Y
 * @param {Array}  array  Buffer donde se almacena este disparo
 * @param {Image}  img    Imagen del proyectil
 */
function Shot(x, y, array, img) {
    this.posX       = x;
    this.posY       = y;
    this.image      = img;
    this.speed      = CONFIG.SHOT_SPEED;
    this.identifier = 0;

    this.add = function () {
        array.push(this);
    };

    this.deleteShot = function (id) {
        arrayRemove(array, id);
    };
}

/**
 * Proyectil del jugador: sube en pantalla.
 * Incluye detección de colisión con el enemigo activo.
 */
function PlayerShot(x, y) {
    Shot.call(this, x, y, GameState.playerShotsBuffer, GameState.images.playerShot);

    this.isHittingEvil = function () {
        var e = GameState.evil;
        return (
            !e.dead &&
            this.posX >= e.posX &&
            this.posX <= (e.posX + e.image.width) &&
            this.posY >= e.posY &&
            this.posY <= (e.posY + e.image.height)
        );
    };
}
PlayerShot.prototype = Object.create(Shot.prototype);
PlayerShot.prototype.constructor = PlayerShot;

/**
 * Proyectil del enemigo: baja en pantalla.
 * Incluye detección de colisión con el jugador.
 */
function EvilShot(x, y) {
    Shot.call(this, x, y, GameState.evilShotsBuffer, GameState.images.evilShot);

    this.isHittingPlayer = function () {
        var p = GameState.player;
        return (
            this.posX >= p.posX &&
            this.posX <= (p.posX + p.width) &&
            this.posY >= p.posY &&
            this.posY <= (p.posY + p.height)
        );
    };
}
EvilShot.prototype = Object.create(Shot.prototype);
EvilShot.prototype.constructor = EvilShot;


/* ══════════════════════════════════════════════════════════
   ENEMIGOS
   ══════════════════════════════════════════════════════════ */

/**
 * Clase base para todos los enemigos.
 * Gestiona animación, movimiento horizontal, disparos y estado de vida.
 *
 * @param {number} life         Vidas iniciales
 * @param {number} shots        Disparos disponibles
 * @param {Object} enemyImages  { animation: Image[], killed: Image }
 */
function Enemy(life, shots, enemyImages) {
    var canvas = GameState.canvas;

    this.image       = enemyImages.animation[0];
    this.imageNumber = 1;
    this.animation   = 0;
    this.posX        = getRandomNumber(canvas.width - (this.image.width || 50));
    this.posY        = -50;
    this.life        = life  || CONFIG.EVIL_LIFE;
    this.maxLife     = this.life;   // RP 021: para la barra de vida
    this.speed       = CONFIG.EVIL_SPEED;
    this.shots       = shots || CONFIG.EVIL_SHOTS;
    this.dead        = false;
    this.hitFlash    = 0;           // RP 021: frames de parpadeo al recibir impacto

    /* Rango de movimiento horizontal aleatorio */
    var offset   = CONFIG.MIN_H_OFFSET + getRandomNumber(CONFIG.MAX_H_OFFSET - CONFIG.MIN_H_OFFSET);
    this.minX    = getRandomNumber(canvas.width - offset);
    this.maxX    = this.minX + offset - 40;
    this.direction = 'D';

    /* goDownSpeed debe ser definido por cada subclase */
    this.goDownSpeed = CONFIG.EVIL_SPEED;

    /* ── Muerte ── */
    this.kill = function () {
        this.dead = true;
        GameState.totalEvils--;
        this.image = enemyImages.killed;
        verifyToCreateNewEvil();
    };

    /* ── Movimiento horizontal base (puede ser sobreescrito) ── */
    this.moveHorizontal = function () {
        if (this.direction === 'D') {
            if (this.posX <= this.maxX) { this.posX += this.speed; }
            else { this.direction = 'I'; this.posX -= this.speed; }
        } else {
            if (this.posX >= this.minX) { this.posX -= this.speed; }
            else { this.direction = 'D'; this.posX += this.speed; }
        }
    };

    /* ── Actualización por frame ── */
    this.update = function () {
        this.posY += this.goDownSpeed;
        this.moveHorizontal();

        /* Animación de sprites (ciclo de 8 frames) */
        this.animation++;
        if (this.animation > 5) {
            this.animation = 0;
            this.imageNumber = (this.imageNumber % 8) + 1;
            this.image = enemyImages.animation[this.imageNumber - 1];
        }
    };

    this.isOutOfScreen = function () {
        return this.posY > (GameState.canvas.height + 15);
    };

    /* ── Sistema de disparos del enemigo ── */
    var self = this;
    function shootEnemy() {
        var e = GameState.evil;
        if (e && e.shots > 0 && !e.dead) {
            var disparo = new EvilShot(
                e.posX + (e.image.width / 2) - 5,
                e.posY + e.image.height
            );
            disparo.add();
            e.shots--;
            gameSetTimeout(shootEnemy, getRandomNumber(3000));
        }
    }
    gameSetTimeout(shootEnemy, 1000 + getRandomNumber(2500));
}


/**
 * Enemigo estándar: movimiento lateral.
 * RP 020 – Tipo 1
 */
function Evil(life, shots) {
    Enemy.call(this, life, shots, {
        animation : GameState.images.evilFrames,
        killed    : GameState.images.evilKilled
    });
    this.goDownSpeed  = CONFIG.EVIL_SPEED * GameState.difficultyMultiplier;
    this.pointsToKill = 5 + GameState.evilCounter;
    this.type         = 'normal';
}
Evil.prototype = Object.create(Enemy.prototype);
Evil.prototype.constructor = Evil;


/**
 * Enemigo rápido: baja en línea recta sin desplazamiento lateral ni disparos.
 * Su amenaza es la velocidad, no los proyectiles.
 * RP 020 – Tipo 2
 */
function EvilFast(life, shots) {
    Enemy.call(this, life, 0, {   /* shots = 0: nunca dispara */
        animation : GameState.images.evilFrames,
        killed    : GameState.images.evilKilled
    });
    this.goDownSpeed  = (CONFIG.EVIL_SPEED + 0.8) * GameState.difficultyMultiplier;
    this.pointsToKill = 8 + GameState.evilCounter;
    this.type         = 'fast';

    /* Sin movimiento lateral */
    this.moveHorizontal = function () {};
}
EvilFast.prototype = Object.create(Enemy.prototype);
EvilFast.prototype.constructor = EvilFast;


/**
 * Enemigo en zigzag: movimiento sinusoidal.
 * RP 020 – Tipo 3
 */
function EvilZigzag(life, shots) {
    Enemy.call(this, life, shots, {
        animation : GameState.images.evilFrames,
        killed    : GameState.images.evilKilled
    });
    this.goDownSpeed     = CONFIG.EVIL_SPEED * GameState.difficultyMultiplier;
    this.pointsToKill    = 10 + GameState.evilCounter;
    this.type            = 'zigzag';
    this.zigzagTimer     = 0;
    this.zigzagAmplitude = 3 + GameState.evilCounter;

    this.moveHorizontal = function () {
        var canvas = GameState.canvas;
        this.zigzagTimer += 0.15;
        this.posX += Math.sin(this.zigzagTimer) * this.zigzagAmplitude;
        /* Mantener dentro del canvas */
        if (this.posX < 5) this.posX = 5;
        if (this.posX > canvas.width - this.image.width - 5)
            this.posX = canvas.width - this.image.width - 5;
    };
}
EvilZigzag.prototype = Object.create(Enemy.prototype);
EvilZigzag.prototype.constructor = EvilZigzag;


/**
 * Jefe final: 2 fases con embestidas laterales en fase 2.
 * RP 016
 */
function FinalBoss() {
    Enemy.call(this, CONFIG.BOSS_LIFE, CONFIG.BOSS_SHOTS, {
        animation : GameState.images.bossFrames,
        killed    : GameState.images.bossKilled
    });

    this.goDownSpeed       = CONFIG.EVIL_SPEED / 4;         // Fase 1: muy lento
    this.goDownSpeedPhase2 = CONFIG.EVIL_SPEED / 2.5;       // Fase 2: algo más rápido
    this.pointsToKill      = 50;
    this.type              = 'boss';

    /* Estado de fases */
    this.phase           = 1;
    this.chargeTimer     = 0;
    this.charging        = false;
    this.chargeDirection = 1;
    this.normalSpeed     = this.speed;

    /**
     * Movimiento especial del jefe:
     *  - Fase 1: lateral estándar
     *  - Fase 2: embestidas horizontales cada ~60 frames + mayor velocidad
     */
    this.moveHorizontal = function () {
        var canvas = GameState.canvas;

        /* Transición a fase 2 al perder el 50 % de vida */
        if (!this.charging && this.phase === 1 && this.life <= Math.floor(CONFIG.BOSS_LIFE / 2)) {
            this.phase        = 2;
            this.speed        = this.normalSpeed * 2.5;
            this.goDownSpeed  = this.goDownSpeedPhase2;
            Sounds.bossPhase2();    /* RP 015: alarma de fase 2 */
        }

        if (this.phase === 2) {
            this.chargeTimer++;

            /* Iniciar embestida */
            if (this.chargeTimer > 60 && !this.charging) {
                this.charging        = true;
                this.chargeDirection = (this.posX < canvas.width / 2) ? 1 : -1;
                this.chargeTimer     = 0;
            }

            if (this.charging) {
                this.posX += this.speed * 3 * this.chargeDirection;
                /* Rebotar en los bordes */
                if (this.posX <= 5 || this.posX >= canvas.width - this.image.width - 5) {
                    this.charging        = false;
                    this.chargeDirection *= -1;
                }
            } else {
                /* Movimiento lateral entre embestidas */
                if (this.direction === 'D') {
                    if (this.posX <= this.maxX) { this.posX += this.speed; }
                    else { this.direction = 'I'; }
                } else {
                    if (this.posX >= this.minX) { this.posX -= this.speed; }
                    else { this.direction = 'D'; }
                }
            }
        } else {
            /* Fase 1: movimiento estándar */
            if (this.direction === 'D') {
                if (this.posX <= this.maxX) { this.posX += this.speed; }
                else { this.direction = 'I'; this.posX -= this.speed; }
            } else {
                if (this.posX >= this.minX) { this.posX -= this.speed; }
                else { this.direction = 'D'; this.posX += this.speed; }
            }
        }
    };
}
FinalBoss.prototype = Object.create(Enemy.prototype);
FinalBoss.prototype.constructor = FinalBoss;


/* ══════════════════════════════════════════════════════════
   JUGADOR
   ══════════════════════════════════════════════════════════ */

/**
 * Crea y configura la nave del jugador.
 * Usa una Image como base para poder dibujarse con drawImage.
 *
 * @param {number} life   Vidas iniciales
 * @param {number} score  Puntuación actual
 * @returns {Image}       El objeto jugador enriquecido con propiedades del juego
 */
function Player(life, score) {
    var MARGIN_BOTTOM   = 10;
    var DEFAULT_HEIGHT  = 66;
    var canvas          = GameState.canvas;

    var p = new Image();
    p.src  = 'images/bueno.png';
    p.posX = (canvas.width / 2) - (p.width / 2);
    p.posY = canvas.height - (p.height === 0 ? DEFAULT_HEIGHT : p.height) - MARGIN_BOTTOM;
    p.life  = life;
    p.score = score;
    p.dead  = false;
    p.speed = CONFIG.PLAYER_SPEED;

    /* ── Disparo del jugador (RP 018/028) ── */
    function shoot() {
        var now = new Date().getTime();
        if (now >= GameState.nextPlayerShot) {
            var shot = new PlayerShot(
                p.posX + (p.width / 2) - 5,
                p.posY
            );
            shot.add();
            GameState.nextPlayerShot = now + CONFIG.SHOT_DELAY_MS;
            Sounds.shoot();     /* RP 015: sonido de disparo */
        }
    }

    /* ── Movimiento y acción por frame ── */
    p.doAnything = function () {
        if (p.dead) return;
        if (GameState.keyPressed.left  && p.posX > 5)
            p.posX -= p.speed;
        if (GameState.keyPressed.right && p.posX < (canvas.width - p.width - 5))
            p.posX += p.speed;
        if (GameState.keyPressed.fire)
            shoot();
    };

    /* ── Recibir daño / morir ── */
    p.killPlayer = function () {
        if (this.life > 0) {
            this.dead = true;
            Sounds.playerDeath();   /* RP 015: sonido al perder vida */
            GameState.evilShotsBuffer.splice(0, GameState.evilShotsBuffer.length);
            GameState.playerShotsBuffer.splice(0, GameState.playerShotsBuffer.length);
            this.src = GameState.images.playerKilled.src;
            createNewEvil();
            gameSetTimeout(function () {
                GameState.player = new Player(GameState.player.life - 1, GameState.player.score);
            }, 500);
        } else {
            Sounds.gameOver();      /* RP 015: sonido de game over */
            Scores.saveFinalScore();
            GameState.youLoose = true;
        }
    };

    GameState.player = p;
    return p;
}