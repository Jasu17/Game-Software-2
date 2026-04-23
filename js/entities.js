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
 * Si vxOverride/vyOverride están definidos se mueve en esa dirección (abanico del jefe).
 */
function EvilShot(x, y) {
    Shot.call(this, x, y, GameState.evilShotsBuffer, GameState.images.evilShot);

    /* Vectores de dirección para disparos en abanico (opcionales) */
    this.vxOverride = null;
    this.vyOverride = null;

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
        this.image = enemyImages.killed;
        /* La lógica de progresión la gestiona buildEnemy() en game.js
           sobreescribiendo este método con onEnemyRemoved() */
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

    /* goDownSpeed: positivo = baja, negativo = sube (rebote) */
    this.bouncing      = false;  /* las subclases que rebotan lo ponen en true */
    this.bounceMinY    = 40;     /* límite superior de rebote */
    this.bounceMaxY    = 0;      /* límite inferior — se calcula al primer update */

    /* ── Actualización por frame ── */
    this.update = function () {
        /* Calcular límite inferior la primera vez que se conoce el canvas */
        if (this.bounceMaxY === 0) {
            this.bounceMaxY = GameState.canvas.height * 0.55;
        }

        if (this.bouncing) {
            this.posY += this.goDownSpeed;
            /* Rebotar al llegar a los límites */
            if (this.posY <= this.bounceMinY) {
                this.goDownSpeed = Math.abs(this.goDownSpeed);   /* forzar bajada */
            } else if (this.posY >= this.bounceMaxY) {
                this.goDownSpeed = -Math.abs(this.goDownSpeed);  /* forzar subida */
            }
        } else {
            /* Comportamiento original: baja continuamente */
            this.posY += this.goDownSpeed;
        }

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
        /* Solo los no-rebotantes pueden salir de pantalla */
        if (this.bouncing) return false;
        return this.posY > (GameState.canvas.height + 15);
    };

    /* ── Sistema de disparos del enemigo ── */
    var self = this;
    function shootEnemy() {
        /* Usar referencia directa al enemigo (self), no GameState.evil,
           para soportar múltiples enemigos simultáneos en pantalla. */
        if (self.shots > 0 && !self.dead) {
            self.firePattern();   /* cada subclase puede sobreescribir firePattern */
            self.shots--;
            gameSetTimeout(shootEnemy, 800 + getRandomNumber(2200));
        }
    }
    gameSetTimeout(shootEnemy, 1000 + getRandomNumber(2500));

    /* Patrón de disparo base: un proyectil recto hacia abajo */
    this.firePattern = function () {
        var disparo = new EvilShot(
            self.posX + (self.image.width / 2) - 5,
            self.posY + self.image.height
        );
        disparo.add();
    };
}


/**
 * Enemigo estándar: movimiento lateral + rebote arriba-abajo.
 * RP 020 – Tipo 1
 */
function Evil(life, shots) {
    Enemy.call(this, life, shots, {
        animation : GameState.images.evilFrames,
        killed    : GameState.images.evilKilled
    });
    this.goDownSpeed  = CONFIG.EVIL_SPEED * GameState.difficultyMultiplier;
    this.pointsToKill = 5 + GameState.currentLevelIndex;
    this.type         = 'normal';
    this.bouncing     = true;   /* rebota arriba-abajo, no sale de pantalla */
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
    this.pointsToKill = 8 + GameState.currentLevelIndex;
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
    this.pointsToKill    = 10 + GameState.currentLevelIndex;
    this.type            = 'zigzag';
    this.bouncing        = true;   /* rebota arriba-abajo, no sale de pantalla */
    this.zigzagTimer     = 0;
    this.zigzagAmplitude = 3 + GameState.currentLevelIndex;

    this.moveHorizontal = function () {
        var canvas = GameState.canvas;
        this.zigzagTimer += 0.15;
        this.posX += Math.sin(this.zigzagTimer) * this.zigzagAmplitude;
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
    /**
     * Patrón de disparo del jefe:
     *  - Fase 1: abanico de 3 proyectiles
     *  - Fase 2: abanico de 5 proyectiles + 2 dirigidos al jugador
     */
    var bossRef = this;
    this.firePattern = function () {
        var cx  = bossRef.posX + bossRef.image.width / 2;
        var cy  = bossRef.posY + bossRef.image.height;
        var angles, i, angle, vx, vy, shot;

        if (bossRef.phase === 1) {
            /* Abanico de 3: centro, izquierda y derecha */
            angles = [-0.35, 0, 0.35];
        } else {
            /* Abanico de 5 + 2 dirigidos al jugador */
            angles = [-0.6, -0.3, 0, 0.3, 0.6];
            /* Disparos dirigidos */
            var p  = GameState.player;
            var dx = (p.posX + p.width  / 2) - cx;
            var dy = (p.posY + p.height / 2) - cy;
            var dist = Math.sqrt(dx * dx + dy * dy) || 1;
            for (i = 0; i < 2; i++) {
                shot = new EvilShot(cx - 5, cy);
                shot.vxOverride = (dx / dist) * CONFIG.SHOT_SPEED * (0.9 + i * 0.2);
                shot.vyOverride = (dy / dist) * CONFIG.SHOT_SPEED * (0.9 + i * 0.2);
                shot.add();
            }
        }

        for (i = 0; i < angles.length; i++) {
            angle = Math.PI / 2 + angles[i];   /* base: recto hacia abajo */
            shot  = new EvilShot(cx - 5, cy);
            shot.vxOverride = Math.cos(angle) * CONFIG.SHOT_SPEED;
            shot.vyOverride = Math.sin(angle) * CONFIG.SHOT_SPEED;
            shot.add();
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
        if (this.dead) return;   /* evitar llamadas múltiples en el mismo frame */
        if (this.life > 0) {
            this.dead = true;
            Sounds.playerDeath();
            GameState.evilShotsBuffer.splice(0, GameState.evilShotsBuffer.length);
            GameState.playerShotsBuffer.splice(0, GameState.playerShotsBuffer.length);
            this.src = GameState.images.playerKilled.src;
            /* Ya no llamar createNewEvil() — el sistema de oleadas lo gestiona */
            gameSetTimeout(function () {
                GameState.player = new Player(GameState.player.life - 1, GameState.player.score);
            }, 500);
        } else {
            Sounds.gameOver();
            Scores.saveFinalScore();
            GameState.youLoose = true;
        }
    };

    GameState.player = p;
    return p;
}