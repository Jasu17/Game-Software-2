/**
 * game.js
 * Módulo principal: loop de juego, gestión de enemigos, colisiones,
 * teclado, pausa, instrucciones y reinicio de partida/nivel.
 *
 * Depende de: utils.js, config.js, entities.js, renderer.js, scores.js
 */

var game = (function () {

    /* ══════════════════════════════════════════════════════════
       INICIALIZACIÓN
       ══════════════════════════════════════════════════════════ */

    function preloadImages() {
        var imgs = GameState.images;

        /* Frames de animación de enemigos y jefe (8 sprites cada uno) */
        for (var i = 1; i <= 8; i++) {
            var evilImg = new Image();
            evilImg.src = 'images/malo' + i + '.png';
            imgs.evilFrames[i - 1] = evilImg;

            var bossImg = new Image();
            bossImg.src = 'images/jefe' + i + '.png';
            imgs.bossFrames[i - 1] = bossImg;
        }

        imgs.evilKilled.src   = 'images/malo_muerto.png';
        imgs.bossKilled.src   = 'images/jefe_muerto.png';
        imgs.bgMain.src       = 'images/fondovertical.png';
        imgs.bgBoss.src       = 'images/fondovertical_jefe.png';
        imgs.playerShot.src   = 'images/disparo_bueno.png';
        imgs.evilShot.src     = 'images/disparo_malo.png';
        imgs.playerKilled.src = 'images/bueno_muerto.png';
    }

    function init() {
        preloadImages();

        var canvas = document.getElementById('canvas');
        GameState.canvas    = canvas;
        GameState.ctx       = canvas.getContext('2d');
        GameState.buffer    = document.createElement('canvas');
        GameState.buffer.width  = canvas.width;
        GameState.buffer.height = canvas.height;
        GameState.bufferctx = GameState.buffer.getContext('2d');

        GameState.keyPressed = { left: false, right: false, fire: false };

        GameState.selectedDifficulty = 1;
        /* RP 010: campo de nombre activo al arrancar */
        GameState.nameInputActive    = true;
        GameState.optionsNameActive  = false;
        GameState.tutorialStep       = 0;      /* RP 003: paso actual del tutorial */

        Scores.renderBestScores();

        /* RP 022: arrancar en pantalla de inicio */
        GameState.showingStartScreen  = true;
        GameState.showingInstructions = false;
        GameState.showingOptions      = false;

        /* RP 006: botón de pausa/jugar */
        addListener(document.getElementById('btn-pause'), 'click', togglePause);

        /* RP 023/024: clics en el canvas para los botones de la pantalla inicio y opciones */
        addListener(canvas, 'click', handleCanvasClick);

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup',   keyUp);

        (function anim() {
            loop();
            requestAnimFrame(anim);
        })();
    }

    /* ══════════════════════════════════════════════════════════
       LOOP PRINCIPAL
       ══════════════════════════════════════════════════════════ */

    function loop() {
        /* RP 006: pausa — solo dibuja el overlay, no actualiza estado */
        if (GameState.paused) {
            Renderer.drawPauseScreen();
            Renderer.flush();
            return;
        }
        update();
        Renderer.flush();
    }

    function update() {
        Renderer.drawBackground();

        /* RP 022: pantalla de inicio */
        if (GameState.showingStartScreen) {
            Renderer.drawStartScreen();
            return;
        }

        /* RP 024: menú de opciones */
        if (GameState.showingOptions) {
            Renderer.drawOptionsMenu();
            return;
        }

        /* RP 027: pantalla de instrucciones */
        if (GameState.showingInstructions) {
            Renderer.drawInstructions();
            return;
        }

        /* Pantallas de fin de juego */
        if (GameState.congratulations) {
            Renderer.drawCongratulations();
            if (!GameState.endOverlayShown) {
                GameState.endOverlayShown = true;
                showEndOverlay(true);
            }
            return;
        }

        if (GameState.youLoose) {
            Renderer.drawGameOver();
            if (!GameState.endOverlayShown) {
                GameState.endOverlayShown = true;
                showEndOverlay(false);
            }
            return;
        }

        /* ── Juego activo ── */
        Renderer.drawPlayer();
        Renderer.drawEvil();
        Renderer.drawEvilHealthBar();
        Renderer.drawImpactParticles();  /* RP 004 */

        updateEvil();
        updatePlayerShots();

        if (isEvilHittingPlayer()) {
            GameState.player.killPlayer();
        } else {
            updateEvilShots();
        }

        Renderer.drawRewardMessage();
        Renderer.drawHUD();

        GameState.player.doAnything();
    }

    /* ══════════════════════════════════════════════════════════
       DISPAROS
       ══════════════════════════════════════════════════════════ */

    function updatePlayerShots() {
        var buf = GameState.playerShotsBuffer;
        for (var j = 0; j < buf.length; j++) {
            var shot = buf[j];
            if (!shot) continue;
            shot.identifier = j;

            if (checkCollision(shot)) {
                if (shot.posY > 0) {
                    shot.posY -= shot.speed;
                    GameState.bufferctx.drawImage(shot.image, shot.posX, shot.posY);
                } else {
                    shot.deleteShot(j);
                }
            }
        }
    }

    function updateEvilShots() {
        var buf = GameState.evilShotsBuffer;
        for (var i = 0; i < buf.length; i++) {
            var shot = buf[i];
            if (!shot) continue;
            shot.identifier = i;

            if (!shot.isHittingPlayer()) {
                if (shot.posY <= GameState.canvas.height) {
                    shot.posY += shot.speed;
                    GameState.bufferctx.drawImage(shot.image, shot.posX, shot.posY);
                } else {
                    shot.deleteShot(i);
                }
            } else {
                GameState.player.killPlayer();
            }
        }
    }

    /* ══════════════════════════════════════════════════════════
       COLISIONES
       ══════════════════════════════════════════════════════════ */

    /**
     * Comprueba si un disparo del jugador golpea al enemigo activo.
     * Si golpea: reduce vida o mata al enemigo y otorga puntos.
     * @returns {boolean} true si el disparo sigue activo, false si fue eliminado
     */
    function checkCollision(shot) {
        if (!shot.isHittingEvil()) return true;

        var e = GameState.evil;
        spawnImpactParticles(shot.posX, shot.posY, e instanceof FinalBoss);

        if (e.life > 1) {
            e.life--;
            e.hitFlash = 6;
            Sounds.hit();           /* RP 015: sonido de impacto */
        } else {
            var pts = e.pointsToKill;
            e.kill();
            GameState.player.score += pts;
            GameState.rewardMessage = { text: '+' + pts + ' pts!', x: e.posX, y: e.posY, timer: 60, alpha: 1.0 };
            Sounds.enemyKill();     /* RP 015: sonido de enemigo eliminado */
        }
        shot.deleteShot(parseInt(shot.identifier));
        return false;
    }

    /* RP 004: crear partículas al impactar */
    function spawnImpactParticles(x, y, isBoss) {
        var count  = isBoss ? 10 : 6;
        var colors = isBoss
            ? ['#FF4444', '#FF8800', '#FFD700', '#FF2200']
            : ['#FFD700', '#FFFFFF', '#88CCFF'];

        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
            var speed = 1.5 + Math.random() * 2.5;
            GameState.impactParticles.push({
                x      : x,
                y      : y,
                vx     : Math.cos(angle) * speed,
                vy     : Math.sin(angle) * speed - 1,
                life   : 20 + Math.floor(Math.random() * 15),
                maxLife: 35,
                size   : 2 + Math.floor(Math.random() * 3),
                color  : colors[Math.floor(Math.random() * colors.length)]
            });
        }
    }

    /**
     * Detecta si el cuerpo del enemigo colisiona con el cuerpo del jugador.
     * @returns {boolean}
     */
    function isEvilHittingPlayer() {
        var e = GameState.evil;
        var p = GameState.player;
        return (
            (e.posY + e.image.height) > p.posY &&
            (p.posY + p.height) >= e.posY &&
            (
                (p.posX >= e.posX && p.posX <= (e.posX + e.image.width)) ||
                (p.posX + p.width >= e.posX && (p.posX + p.width) <= (e.posX + e.image.width))
            )
        );
    }

    /* ══════════════════════════════════════════════════════════
       ENEMIGOS: CREACIÓN Y PROGRESIÓN
       ══════════════════════════════════════════════════════════ */

    /**
     * Actualiza la posición del enemigo activo cada frame.
     * RP 013: si sale de pantalla, penaliza al jugador.
     */
    function updateEvil() {
        var e = GameState.evil;
        if (e.dead) return;
        e.update();
        if (e.isOutOfScreen()) {
            GameState.player.killPlayer();
            e.kill();
        }
    }

    /**
     * Comprueba si quedan enemigos y crea el siguiente,
     * o activa la victoria si era el último.
     */
    function verifyToCreateNewEvil() {
        if (GameState.totalEvils > 0) {
            gameSetTimeout(function () {
                GameState.evilCounter++;
                GameState.difficultyMultiplier = 1.0 + (GameState.evilCounter - 1) * CONFIG.DIFFICULTY_STEP;
                createNewEvil();
            }, getRandomNumber(3000));
        } else {
            /* RP 012: victoria */
            gameSetTimeout(function () {
                Sounds.victory();       /* RP 015 */
                Scores.saveFinalScore();
                GameState.congratulations = true;
            }, 2000);
        }
    }

    /**
     * Instancia el enemigo apropiado según el nivel actual.
     * RP 020: 3 tipos de enemigos + jefe final.
     */
    function createNewEvil() {
        var gs = GameState;
        var e;

        if (gs.totalEvils === 1) {
            /* Último enemigo siempre es el jefe final */
            e = new FinalBoss();
        } else {
            var vida     = CONFIG.EVIL_LIFE  + gs.evilCounter - 1;
            var disparos = CONFIG.EVIL_SHOTS + gs.evilCounter - 1;
            var type;

            /* Los dos primeros enemigos son normales para que el jugador aprenda */
            if (gs.evilCounter <= 2) {
                type = 'normal';
            } else {
                var rand = getRandomNumber(10);
                type = (rand < 4) ? 'normal' : (rand < 7) ? 'fast' : 'zigzag';
            }

            if      (type === 'fast')   e = new EvilFast(vida, disparos);
            else if (type === 'zigzag') e = new EvilZigzag(vida, disparos);
            else                        e = new Evil(vida, disparos);
        }

        gs.evil = e;

        /* RP 017: guardar snapshot para poder reiniciar el nivel */
        gs.currentEvilSnapshot = {
            type    : e.type,
            vida    : e.maxLife,
            disparos: e.shots
        };
    }

    /* ══════════════════════════════════════════════════════════
       INICIO / REINICIO (RP 001, RP 017)
       ══════════════════════════════════════════════════════════ */

    function startGame() {
        clearAllTimeouts();
        var gs = GameState;

        /* RP 014: aplicar dificultad — diferencias notables entre niveles */
        var diffMods = [
            { speedMod: 0.45, shotMod: 0.4, bossLife: 6,  bossShots: 15, diffStep: 0.08, shotDelay: 350 },  /* Fácil */
            { speedMod: 1.0,  shotMod: 1.0, bossLife: 12, bossShots: 30, diffStep: 0.15, shotDelay: 250 },  /* Normal */
            { speedMod: 1.8,  shotMod: 1.8, bossLife: 18, bossShots: 50, diffStep: 0.25, shotDelay: 200 }   /* Difícil */
        ];
        var mod = diffMods[gs.selectedDifficulty || 1];
        CONFIG.EVIL_SPEED      = 1   * mod.speedMod;
        CONFIG.EVIL_SHOTS      = Math.round(5  * mod.shotMod);
        CONFIG.BOSS_LIFE       = mod.bossLife;
        CONFIG.BOSS_SHOTS      = mod.bossShots;
        CONFIG.DIFFICULTY_STEP = mod.diffStep;
        CONFIG.SHOT_DELAY_MS   = mod.shotDelay;

        gs.showingStartScreen  = false;
        gs.showingInstructions = false;
        gs.showingOptions      = false;
        gs.youLoose            = false;
        gs.congratulations     = false;
        gs.endOverlayShown     = false;
        gs.paused              = false;
        gs.totalEvils          = CONFIG.TOTAL_EVILS;
        gs.evilCounter         = 1;
        gs.difficultyMultiplier= 1.0;
        gs.playerShotsBuffer   = [];
        gs.evilShotsBuffer     = [];
        gs.rewardMessage       = null;
        gs.impactParticles     = [];
        gs.nextPlayerShot      = 0;

        gs.player = new Player(CONFIG.PLAYER_LIFE, 0);
        createNewEvil();
        updatePauseButton(false);
        hideEndOverlay();
    }

    /** Reinicia solo el nivel actual (mismo enemigo). RP 017 */
    function restartCurrentLevel() {
        var snap = GameState.currentEvilSnapshot;
        if (!snap) return;

        clearAllTimeouts();
        var gs = GameState;
        gs.youLoose        = false;
        gs.congratulations = false;
        gs.endOverlayShown = false;
        gs.paused          = false;
        gs.rewardMessage   = null;
        gs.evilShotsBuffer.splice(0, gs.evilShotsBuffer.length);
        gs.playerShotsBuffer.splice(0, gs.playerShotsBuffer.length);

        /* Conservar puntuación; reiniciar con 1 vida */
        gs.player = new Player(1, gs.player.score);

        /* Recrear el mismo enemigo con los parámetros originales */
        var e;
        if      (snap.type === 'boss')   e = new FinalBoss();
        else if (snap.type === 'fast')   e = new EvilFast(snap.vida, snap.disparos);
        else if (snap.type === 'zigzag') e = new EvilZigzag(snap.vida, snap.disparos);
        else                             e = new Evil(snap.vida, snap.disparos);
        gs.evil = e;

        updatePauseButton(false);
        hideEndOverlay();
    }

    /* ══════════════════════════════════════════════════════════
       PAUSA (RP 006)
       ══════════════════════════════════════════════════════════ */

    function togglePause() {
        var gs = GameState;

        /* Desde pantalla de inicio: ir a instrucciones */
        if (gs.showingStartScreen) {
            gs.showingStartScreen  = false;
            gs.showingInstructions = true;
            updatePauseButton(false);
            return;
        }
        /* Desde instrucciones: avanzar paso o iniciar */
        if (gs.showingInstructions) {
            gs.tutorialStep = (gs.tutorialStep || 0) + 1;
            if (gs.tutorialStep >= 3) {
                gs.tutorialStep = 0;
                startGame();
            }
            return;
        }
        /* Desde opciones: volver a inicio */
        if (gs.showingOptions) {
            gs.showingOptions     = false;
            gs.showingStartScreen = true;
            return;
        }
        /* No pausar en pantallas de fin */
        if (gs.youLoose || gs.congratulations) return;

        gs.paused = !gs.paused;
        updatePauseButton(gs.paused);
    }

    /* RP 010/011/023/024: detectar clics sobre los botones dibujados en canvas */
    function handleCanvasClick(e) {
        var gs     = GameState;
        var rect   = gs.canvas.getBoundingClientRect();
        var mouseX = e.clientX - rect.left;
        var mouseY = e.clientY - rect.top;
        var cw     = gs.canvas.width;
        var ch     = gs.canvas.height;

        /* ── Pausa: botón Menú principal ── */
        if (gs.paused) {
            var cw2 = gs.canvas.width;
            var ch2 = gs.canvas.height;
            if (mouseX >= cw2 / 2 - 90 && mouseX <= cw2 / 2 + 90 &&
                mouseY >= ch2 / 2 + 40  && mouseY <= ch2 / 2 + 78) {
                goToMainMenu();
            }
            return;
        }

        /* ── Pantalla de inicio ── */
        if (gs.showingStartScreen) {
            var btnW     = 200;
            var btnH     = 44;
            var btnX     = cw / 2 - btnW / 2;
            var nameBoxY = 238;
            var btnY     = nameBoxY + 50;
            var optY     = btnY + btnH + 12;

            /* Clic en caja de nombre (RP 010) */
            if (mouseX >= cw / 2 - 130 && mouseX <= cw / 2 + 130 &&
                mouseY >= nameBoxY      && mouseY <= nameBoxY + 30) {
                gs.nameInputActive = true;
                return;
            }

            /* Botón JUGAR */
            if (mouseX >= btnX && mouseX <= btnX + btnW &&
                mouseY >= btnY && mouseY <= btnY + btnH) {
                gs.showingStartScreen  = false;
                gs.showingInstructions = true;
                gs.nameInputActive     = false;
                return;
            }

            /* Botón OPCIONES */
            if (mouseX >= btnX && mouseX <= btnX + btnW &&
                mouseY >= optY  && mouseY <= optY + 36) {
                gs.showingStartScreen = false;
                gs.showingOptions     = true;
                gs.nameInputActive    = false;
                return;
            }

            /* Clic fuera de la caja de nombre desactiva el foco */
            gs.nameInputActive = false;
        }

        /* ── Pantalla de instrucciones (tutorial por pasos) ── */
        if (gs.showingInstructions) {
            var ch2 = gs.canvas.height;
            if (mouseX >= gs.canvas.width / 2 - 90 && mouseX <= gs.canvas.width / 2 + 90 &&
                mouseY >= ch2 - 72 && mouseY <= ch2 - 34) {
                gs.tutorialStep = (gs.tutorialStep || 0) + 1;
                if (gs.tutorialStep >= 3) {
                    gs.tutorialStep = 0;
                    startGame();
                }
            }
            return;
        }

        /* ── Menú de opciones ── */
        if (gs.showingOptions) {
            /* Dificultad */
            for (var i = 0; i < 3; i++) {
                var ox = cw / 2 - 150 + i * 106;
                if (mouseX >= ox && mouseX <= ox + 92 &&
                    mouseY >= 112 && mouseY <= 142) {
                    gs.selectedDifficulty = i;
                    return;
                }
            }

            /* RP 011: Sonido ON */
            if (mouseX >= cw / 2 - 106 && mouseX <= cw / 2 - 10 &&
                mouseY >= 202           && mouseY <= 230) {
                gs.soundEnabled = true;
                return;
            }
            /* RP 011: Sonido OFF */
            if (mouseX >= cw / 2 + 10 && mouseX <= cw / 2 + 106 &&
                mouseY >= 202          && mouseY <= 230) {
                gs.soundEnabled = false;
                return;
            }

            /* RP 011: Tema visual */
            var themes = ['default', 'neon', 'retro'];
            for (var t = 0; t < themes.length; t++) {
                var tx = cw / 2 - 150 + t * 106;
                if (mouseX >= tx && mouseX <= tx + 92 &&
                    mouseY >= 266 && mouseY <= 294) {
                    gs.visualTheme = themes[t];
                    return;
                }
            }

            /* RP 010: clic en campo de nombre dentro de opciones */
            if (mouseX >= cw / 2 - 130 && mouseX <= cw / 2 + 130 &&
                mouseY >= 330           && mouseY <= 358) {
                gs.optionsNameActive = true;
                return;
            }

            /* Botón Volver */
            var backY = ch - 70;
            if (mouseX >= cw / 2 - 80 && mouseX <= cw / 2 + 80 &&
                mouseY >= backY         && mouseY <= backY + 36) {
                gs.showingOptions     = false;
                gs.showingStartScreen = true;
                gs.optionsNameActive  = false;
            }
            /* Clic fuera del campo de nombre lo desactiva */
            gs.optionsNameActive = false;
        }
    }

    function updatePauseButton(isPaused) {
        var btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = isPaused ? '▶ Continuar' : '⏸ Pausar';
    }

    /* ══════════════════════════════════════════════════════════
       OVERLAY FIN DE JUEGO (RP 026 / RP 001)
       ══════════════════════════════════════════════════════════ */

    /** Vuelve al menú principal sin reiniciar la partida. */
    function goToMainMenu() {
        clearAllTimeouts();
        var gs = GameState;
        gs.paused              = false;
        gs.youLoose            = false;
        gs.congratulations     = false;
        gs.endOverlayShown     = false;
        gs.showingStartScreen  = true;
        gs.showingInstructions = false;
        gs.showingOptions      = false;
        gs.nameInputActive     = false;
        gs.optionsNameActive   = false;
        hideEndOverlay();
        updatePauseButton(false);
        /* Restaurar btn-pause a su texto inicial */
        var btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = '\u25b6 Jugar';
    }

    /**
     * Muestra el overlay HTML con botones sobre el canvas.
     * @param {boolean} isVictory  true = victoria, false = game over
     */
    function showEndOverlay(isVictory) {
        var overlay = document.getElementById('end-overlay');
        if (!overlay) return;

        overlay.innerHTML     = '';
        overlay.style.display = 'flex';

        /* Botón: nueva partida (RP 001) */
        var btnNew = document.createElement('button');
        btnNew.textContent = '\uD83D\uDD04 Nueva partida';
        btnNew.className   = 'overlay-btn';
        btnNew.onclick     = startGame;
        overlay.appendChild(btnNew);

        /* Botón: reiniciar nivel (RP 017) — solo en game over */
        if (!isVictory) {
            var btnLevel = document.createElement('button');
            btnLevel.textContent = '\u21A9 Reiniciar nivel';
            btnLevel.className   = 'overlay-btn';
            btnLevel.onclick     = restartCurrentLevel;
            overlay.appendChild(btnLevel);
        }

        /* Botón: menú principal — siempre visible */
        var btnMenu = document.createElement('button');
        btnMenu.textContent = '\uD83C\uDFE0 Men\u00FA principal';
        btnMenu.className   = 'overlay-btn overlay-btn--secondary';
        btnMenu.onclick     = goToMainMenu;
        overlay.appendChild(btnMenu);
    }

    function hideEndOverlay() {
        var overlay = document.getElementById('end-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.innerHTML     = '';
        }
    }

    /* ══════════════════════════════════════════════════════════
       TECLADO
       ══════════════════════════════════════════════════════════ */

    function keyDown(e) {
        var key = window.event ? e.keyCode : e.which;
        var gs  = GameState;

        /* RP 010: capturar nombre en menú de opciones */
        if (gs.showingOptions && gs.optionsNameActive) {
            if (key === 8) {
                e.preventDefault();
                gs.playerName = gs.playerName.slice(0, -1);
                return;
            }
            if (key === 13) {
                e.preventDefault();
                gs.optionsNameActive = false;
                return;
            }
            if (gs.playerName.length < 16 && key >= 32 && key <= 126) {
                e.preventDefault();
                gs.playerName += String.fromCharCode(key);
                return;
            }
            return;
        }

        /* RP 010: capturar texto para el nombre en pantalla de inicio */
        if (gs.showingStartScreen && gs.nameInputActive) {
            if (key === 8) {
                /* Backspace */
                e.preventDefault();
                gs.playerName = gs.playerName.slice(0, -1);
                return;
            }
            if (key === 13 || key === CONFIG.KEY_PAUSE) {
                /* Enter o P: confirmar nombre y avanzar */
                e.preventDefault();
                gs.nameInputActive     = false;
                gs.showingStartScreen  = false;
                gs.showingInstructions = true;
                return;
            }
            /* Letras, números y espacios (máx 16 caracteres) */
            if (gs.playerName.length < 16 && key >= 32 && key <= 126) {
                e.preventDefault();
                gs.playerName += String.fromCharCode(key);
                return;
            }
            return; /* absorber otras teclas mientras escribe */
        }

        /* RP 006/015: P pausa con sonido */
        if (key === CONFIG.KEY_PAUSE) {
            e.preventDefault();
            Sounds.pause();
            togglePause();
            return;
        }

        var kp = gs.keyPressed;
        if (key === CONFIG.KEY_LEFT)  { e.preventDefault(); kp.left  = true; }
        if (key === CONFIG.KEY_RIGHT) { e.preventDefault(); kp.right = true; }
        if (key === CONFIG.KEY_FIRE)  { e.preventDefault(); kp.fire  = true; }
    }

    function keyUp(e) {
        var key = window.event ? e.keyCode : e.which;
        var kp  = GameState.keyPressed;
        if (key === CONFIG.KEY_LEFT)  { e.preventDefault(); kp.left  = false; }
        if (key === CONFIG.KEY_RIGHT) { e.preventDefault(); kp.right = false; }
        if (key === CONFIG.KEY_FIRE)  { e.preventDefault(); kp.fire  = false; }
    }

    /* ══════════════════════════════════════════════════════════
       API PÚBLICA
       ══════════════════════════════════════════════════════════ */

    /* Exponer verifyToCreateNewEvil y createNewEvil para que entities.js los use */
    window.verifyToCreateNewEvil = verifyToCreateNewEvil;
    window.createNewEvil         = createNewEvil;
    window.goToMainMenu          = goToMainMenu;

    return { init: init };

})();