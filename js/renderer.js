/**
 * renderer.js
 * Responsable exclusivamente de dibujar en el canvas (double-buffer).
 * No modifica el estado del juego; solo lee GameState para renderizar.
 *
 * Depende de: utils.js, config.js
 */

var Renderer = (function () {

    /* ── Fondo ─────────────────────────────────────────────────────────── */
    function drawBackground() {
        var gs  = GameState;
        if (!gs.evil) return;
        var bg = (gs.evil instanceof FinalBoss) ? gs.images.bgBoss : gs.images.bgMain;
        gs.bufferctx.drawImage(bg, 0, 0);
    }

    /* ── HUD: puntos, vidas y nombre (RP 002, RP 007, RP 008, RP 010) ───── */
    function drawHUD() {
        var gs     = GameState;
        var ctx    = gs.bufferctx;
        var cw     = gs.canvas.width;
        var theme  = getThemeColors();

        /* Fondo HUD con borde del color del tema */
        ctx.fillStyle   = 'rgba(0, 0, 0, 0.65)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth   = 1;
        roundRect(ctx, cw - 130, 4, 126, 52, 4);
        ctx.fill();
        ctx.stroke();

        /* Puntos — color del tema */
        ctx.fillStyle = theme.title;
        ctx.font      = 'bold 13px Arial';
        ctx.fillText('PUNTOS: ' + gs.player.score, cw - 122, 22);

        /* RP 002: vidas como corazones */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = 'bold 13px Arial';
        ctx.fillText('VIDAS:', cw - 122, 42);
        for (var i = 0; i < CONFIG.PLAYER_LIFE; i++) {
            ctx.font = '15px Arial';
            ctx.fillStyle = (i < gs.player.life) ? '#ff4455' : 'rgba(255,255,255,0.25)';
            ctx.fillText('\u2665', cw - 78 + i * 18, 44);
        }

        /* RP 010: nombre del jugador */
        if (gs.playerName) {
            ctx.fillStyle   = 'rgba(0,0,0,0.55)';
            ctx.strokeStyle = theme.accent;
            ctx.lineWidth   = 1;
            roundRect(ctx, 4, 4, 140, 22, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = theme.accentLight;
            ctx.font      = 'bold 12px Arial';
            ctx.fillText('\u25b6 ' + gs.playerName, 10, 20);
        }

        /* RP 029: indicador de tipo de enemigo */
        drawEvilTypeIndicator(theme);
    }

    /* ── RP 029: indicador visual del tipo de enemigo activo ────────────── */
    function drawEvilTypeIndicator(theme) {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var e   = gs.evil;
        if (!e || e.dead) return;

        var labels = {
            'normal' : { text: 'NORMAL',       color: '#88ccff' },
            'fast'   : { text: 'RAPIDO',        color: '#ffaa44' },
            'zigzag' : { text: 'ZIGZAG',        color: '#cc88ff' },
            'boss'   : { text: '\u26a0 JEFE FINAL', color: '#ff4455' }
        };
        var info = labels[e.type] || labels['normal'];

        ctx.fillStyle   = 'rgba(0,0,0,0.55)';
        ctx.strokeStyle = info.color;
        ctx.lineWidth   = 1;
        roundRect(ctx, 4, gs.canvas.height - 26, 130, 20, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = info.color;
        ctx.font      = 'bold 11px Arial';
        ctx.fillText('ENEMIGO: ' + info.text, 10, gs.canvas.height - 11);
    }

    /* ── Jugador ────────────────────────────────────────────────────────── */
    function drawPlayer() {
        var gs = GameState;
        gs.bufferctx.drawImage(gs.player, gs.player.posX, gs.player.posY);
    }

    /* ── Enemigo + animación de impacto mejorada (RP 004, RP 021) ─────── */
    function drawEvil() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var e   = gs.evil;

        /* RP 004: flash de impacto — anillo del color del tema */
        if (e.hitFlash && e.hitFlash > 0) {
            var progress = (6 - e.hitFlash) / 6;
            var radius   = (e.image.width / 2) * (1 + progress);
            var theme    = getThemeColors();
            ctx.save();
            ctx.globalAlpha = (1 - progress) * 0.7;
            ctx.strokeStyle = theme.title;   /* color del tema en el anillo */
            ctx.lineWidth   = 3;
            ctx.beginPath();
            ctx.arc(
                e.posX + e.image.width / 2,
                e.posY + e.image.height / 2,
                radius, 0, Math.PI * 2
            );
            ctx.stroke();
            ctx.globalAlpha = (1 - progress) * 0.4;
            ctx.fillStyle   = 'white';
            ctx.fillRect(e.posX, e.posY, e.image.width, e.image.height);
            ctx.restore();
            e.hitFlash--;
        }

        ctx.drawImage(e.image, e.posX, e.posY);
    }

    /* ── Partículas de impacto (RP 004) ─────────────────────────────────── */
    function drawImpactParticles() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var ps  = gs.impactParticles;

        for (var i = ps.length - 1; i >= 0; i--) {
            var p = ps[i];
            p.x    += p.vx;
            p.y    += p.vy;
            p.vy   += 0.12;   /* gravedad leve */
            p.life--;

            var alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle   = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.restore();

            if (p.life <= 0) ps.splice(i, 1);
        }
    }

    /* ── Barra de vida del enemigo (RP 021) ─────────────────────────────── */
    function drawEvilHealthBar() {
        var gs    = GameState;
        var ctx   = gs.bufferctx;
        var e     = gs.evil;
        var theme = getThemeColors();
        if (e.dead) return;

        var barW  = e.image.width;
        var barH  = 6;
        var x     = e.posX;
        var y     = e.posY - 12;
        var ratio = e.life / e.maxLife;

        /* Fondo con borde del tema */
        ctx.fillStyle   = 'rgba(0, 0, 0, 0.6)';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth   = 1;
        roundRect(ctx, x - 1, y - 1, barW + 2, barH + 2, 2);
        ctx.fill();
        ctx.stroke();

        /* Vida restante: verde → amarillo → naranja */
        if (ratio > 0.6)       ctx.fillStyle = 'rgba(0,  210,   0, 0.9)';
        else if (ratio > 0.3)  ctx.fillStyle = 'rgba(220, 200,  0, 0.9)';
        else                   ctx.fillStyle = 'rgba(255,  80,  0, 0.9)';
        ctx.fillRect(x, y, barW * ratio, barH);

        /* Texto X/MAX */
        ctx.fillStyle = 'white';
        ctx.font      = 'bold 10px Arial';
        ctx.fillText(e.life + '/' + e.maxLife, x + barW / 2 - 8, y - 2);

        /* Indicador de fase 2 del jefe (RP 016) */
        if (e instanceof FinalBoss && e.phase === 2) {
            ctx.fillStyle = theme.accent;
            ctx.font      = 'bold 11px Arial';
            ctx.fillText('\u00a1FASE 2!', x + barW / 2 - 20, y - 14);
        }
    }

    /* ── Recompensa flotante al eliminar enemigo (RP 019) ───────────────── */
    function drawRewardMessage() {
        var gs  = GameState;
        var msg = gs.rewardMessage;
        if (!msg) return;

        msg.timer--;
        msg.y    -= 1;
        msg.alpha = msg.timer / 60;

        gs.bufferctx.save();
        gs.bufferctx.globalAlpha = msg.alpha;
        gs.bufferctx.fillStyle   = '#FFD700';
        gs.bufferctx.font        = 'bold 18px Arial';
        gs.bufferctx.fillText(msg.text, msg.x, msg.y);
        gs.bufferctx.restore();

        if (msg.timer <= 0) gs.rewardMessage = null;
    }

    /* ── Pantalla de INICIO (RP 009, RP 010, RP 022, RP 023) ───────────── */
    function drawStartScreen() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var cw  = gs.canvas.width;
        var ch  = gs.canvas.height;

        /* RP 011: fondo según tema visual seleccionado */
        var themeColors = getThemeColors();
        var grad = ctx.createLinearGradient(0, 0, 0, ch);
        grad.addColorStop(0, themeColors.bgTop);
        grad.addColorStop(1, themeColors.bgBot);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, ch);

        /* RP 009: Título */
        ctx.fillStyle = themeColors.title;
        ctx.font      = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SPACE INVADERS', cw / 2, 100);

        ctx.fillStyle = themeColors.accent;
        ctx.font      = 'bold 15px Arial';
        ctx.fillText('HTML5 \u00b7 JavaScript', cw / 2, 126);

        ctx.strokeStyle = themeColors.accent;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.moveTo(cw / 2 - 160, 140);
        ctx.lineTo(cw / 2 + 160, 140);
        ctx.stroke();

        /* Descripción breve (RP 005) */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = '14px Arial';
        ctx.fillText('Defiende la Tierra de las oleadas enemigas.', cw / 2, 168);
        ctx.fillText('Elimina a todos antes de que lleguen a tu zona.', cw / 2, 188);
        ctx.fillText('\u00a1El jefe final tiene 2 fases!', cw / 2, 208);

        /* RP 010: campo de nombre — caja de texto simulada en canvas */
        var nameBoxY = 238;
        var nameBoxW = 260;
        var nameBoxX = cw / 2 - nameBoxW / 2;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeStyle = themeColors.accent;
        ctx.lineWidth   = 1.5;
        roundRect(ctx, nameBoxX, nameBoxY, nameBoxW, 30, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font      = '13px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('NOMBRE DEL JUGADOR:', cw / 2, nameBoxY - 6);

        var displayName = gs.playerName || '';
        /* cursor parpadeante cada ~30 frames */
        var cursor = (Math.floor(Date.now() / 500) % 2 === 0) ? '|' : '';
        ctx.fillStyle = gs.playerName ? '#fff' : '#666';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText(
            (displayName || 'Escribe tu nombre...') + (gs.nameInputActive ? cursor : ''),
            cw / 2, nameBoxY + 20
        );

        /* RP 023: Botón JUGAR */
        var btnW  = 200;
        var btnH  = 44;
        var btnX  = cw / 2 - btnW / 2;
        var btnY  = nameBoxY + 50;

        ctx.fillStyle   = themeColors.accent;
        ctx.strokeStyle = themeColors.accentLight;
        ctx.lineWidth   = 2;
        roundRect(ctx, btnX, btnY, btnW, btnH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font      = 'bold 19px Arial';
        ctx.fillText('\u25b6  JUGAR', cw / 2, btnY + 28);

        /* Botón OPCIONES */
        var optY = btnY + btnH + 12;
        ctx.fillStyle   = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = '#666';
        ctx.lineWidth   = 1;
        roundRect(ctx, btnX, optY, btnW, 36, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#bbb';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('\u2699  OPCIONES', cw / 2, optY + 23);

        ctx.fillStyle = 'rgba(100, 220, 100, 0.85)';
        ctx.font      = '12px Arial';
        ctx.fillText('o pulsa P para empezar', cw / 2, optY + 52);

        ctx.textAlign = 'left';
    }

    /* ── Menú de OPCIONES (RP 011, RP 024) ─────────────────────────────── */
    function drawOptionsMenu() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var cw  = gs.canvas.width;
        var ch  = gs.canvas.height;

        ctx.fillStyle = 'rgba(5, 5, 20, 0.96)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center';

        /* Título */
        ctx.fillStyle = '#FFD700';
        ctx.font      = 'bold 28px Arial';
        ctx.fillText('OPCIONES', cw / 2, 58);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(cw / 2 - 90, 68); ctx.lineTo(cw / 2 + 90, 68);
        ctx.stroke();

        /* ── Dificultad ── */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('DIFICULTAD', cw / 2, 102);

        var diffOpts = ['F\u00e1cil', 'Normal', 'Dif\u00edcil'];
        for (var i = 0; i < diffOpts.length; i++) {
            var ox  = cw / 2 - 150 + i * 106;
            var sel = (gs.selectedDifficulty === i);
            ctx.fillStyle   = sel ? '#e94560' : 'rgba(255,255,255,0.08)';
            ctx.strokeStyle = sel ? '#ff6680' : '#444';
            ctx.lineWidth   = sel ? 2 : 1;
            roundRect(ctx, ox, 112, 92, 30, 6);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = sel ? 'white' : '#999';
            ctx.font      = sel ? 'bold 13px Arial' : '13px Arial';
            ctx.fillText(diffOpts[i], ox + 46, 132);
        }
        var diffDesc = ['Enemigos m\u00e1s lentos, menos disparos',
                        'Configuraci\u00f3n est\u00e1ndar',
                        'Enemigos m\u00e1s r\u00e1pidos, m\u00e1s disparos'];
        ctx.fillStyle = '#777'; ctx.font = '12px Arial';
        ctx.fillText(diffDesc[gs.selectedDifficulty || 1], cw / 2, 158);

        /* ── RP 011: Sonido ── */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('SONIDO', cw / 2, 192);

        var sndOn  = gs.soundEnabled;
        /* Botón ON */
        ctx.fillStyle   = sndOn  ? '#27ae60' : 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = sndOn  ? '#2ecc71' : '#444';
        ctx.lineWidth   = sndOn  ? 2 : 1;
        roundRect(ctx, cw / 2 - 106, 202, 96, 28, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = sndOn  ? 'white' : '#777';
        ctx.font      = sndOn  ? 'bold 13px Arial' : '13px Arial';
        ctx.fillText('\uD83D\uDD0A  Activado', cw / 2 - 58, 221);

        /* Botón OFF */
        ctx.fillStyle   = !sndOn ? '#c0392b' : 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = !sndOn ? '#e74c3c' : '#444';
        ctx.lineWidth   = !sndOn ? 2 : 1;
        roundRect(ctx, cw / 2 + 10, 202, 96, 28, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = !sndOn ? 'white' : '#777';
        ctx.font      = !sndOn ? 'bold 13px Arial' : '13px Arial';
        ctx.fillText('\uD83D\uDD07  Silencio', cw / 2 + 58, 221);

        /* ── RP 011: Tema visual ── */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('TEMA VISUAL', cw / 2, 256);

        var themes    = ['default', 'neon', 'retro'];
        var themeLabels = ['Default', 'Neon', 'Retro'];
        for (var t = 0; t < themes.length; t++) {
            var tx  = cw / 2 - 150 + t * 106;
            var sel2 = (gs.visualTheme === themes[t]);
            ctx.fillStyle   = sel2 ? getThemeColors(themes[t]).accent : 'rgba(255,255,255,0.08)';
            ctx.strokeStyle = sel2 ? getThemeColors(themes[t]).accentLight : '#444';
            ctx.lineWidth   = sel2 ? 2 : 1;
            roundRect(ctx, tx, 266, 92, 28, 6);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = sel2 ? 'white' : '#888';
            ctx.font      = sel2 ? 'bold 13px Arial' : '13px Arial';
            ctx.fillText(themeLabels[t], tx + 46, 285);
        }

        /* ── RP 010: Nombre del jugador editable desde opciones ── */
        ctx.fillStyle = '#eaeaea';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('NOMBRE DEL JUGADOR', cw / 2, 320);

        var nbX = cw / 2 - 130;
        var nbY = 330;
        ctx.fillStyle   = 'rgba(0,0,0,0.5)';
        ctx.strokeStyle = gs.optionsNameActive ? '#FFD700' : '#555';
        ctx.lineWidth   = gs.optionsNameActive ? 2 : 1;
        roundRect(ctx, nbX, nbY, 260, 28, 6);
        ctx.fill(); ctx.stroke();

        var cursor2   = (gs.optionsNameActive && Math.floor(Date.now() / 500) % 2 === 0) ? '|' : '';
        ctx.fillStyle = gs.playerName ? '#fff' : '#555';
        ctx.font      = 'bold 13px Arial';
        ctx.fillText(
            (gs.playerName || 'Escribe tu nombre...') + cursor2,
            cw / 2, nbY + 19
        );

        /* ── Botón Volver ── */
        var backY = ch - 70;
        ctx.fillStyle   = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = '#666';
        ctx.lineWidth   = 1;
        roundRect(ctx, cw / 2 - 80, backY, 160, 36, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ccc';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('\u2190  Volver', cw / 2, backY + 23);

        ctx.textAlign = 'left';
    }

    /* ── RP 011: colores según tema visual ──────────────────────────────── */
    function getThemeColors(theme) {
        var t = theme || GameState.visualTheme || 'default';
        var themes = {
            'default': { bgTop: '#0a0a1e', bgBot: '#1a1a2e', title: '#FFD700',
                         accent: '#e94560', accentLight: '#ff6680' },
            'neon'   : { bgTop: '#000510', bgBot: '#001020', title: '#00ffff',
                         accent: '#00e5ff', accentLight: '#80f0ff' },
            'retro'  : { bgTop: '#1a0a00', bgBot: '#2e1500', title: '#ffaa00',
                         accent: '#ff6600', accentLight: '#ff8833' }
        };
        return themes[t] || themes['default'];
    }

    /* ── Tutorial por pasos (RP 003 / RP 027) ──────────────────────────── */
    function drawInstructions() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var cw  = gs.canvas.width;
        var ch  = gs.canvas.height;

        /* El tutorial tiene 3 pasos; se avanza con P o clic en el botón */
        var step = gs.tutorialStep || 0;

        ctx.fillStyle = 'rgb(10, 10, 30)';
        ctx.fillRect(0, 0, cw, ch);
        ctx.textAlign = 'center';

        /* ── Indicador de paso (RP 003) ── */
        var totalSteps = 3;
        for (var d = 0; d < totalSteps; d++) {
            ctx.beginPath();
            ctx.arc(cw / 2 - (totalSteps - 1) * 12 + d * 24, 30, 5, 0, Math.PI * 2);
            ctx.fillStyle = (d === step) ? '#FFD700' : 'rgba(255,255,255,0.2)';
            ctx.fill();
        }

        /* ── Título del paso ── */
        var titles = ['CONTROLES', 'OBJETIVOS', 'ENEMIGOS'];
        ctx.fillStyle = '#FFD700';
        ctx.font      = 'bold 26px Arial';
        ctx.fillText(titles[step], cw / 2, 68);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cw / 2 - 100, 76); ctx.lineTo(cw / 2 + 100, 76);
        ctx.stroke();

        /* ── Contenido por paso ── */
        if (step === 0) {
            /* Paso 1: Controles con iconos dibujados */
            _tutorialRow(ctx, cw / 2, 130, '\u2190 \u2192',   'Mover la nave izquierda / derecha', '#4fc3f7');
            _tutorialRow(ctx, cw / 2, 185, 'ESPACIO',          'Disparar (m\u00e1x 1 bala cada 250 ms)', '#4fc3f7');
            _tutorialRow(ctx, cw / 2, 240, 'P',                'Pausar y reanudar la partida',       '#4fc3f7');

            /* Mini nave animada */
            ctx.fillStyle = '#4fc3f7';
            ctx.font      = '28px Arial';
            ctx.fillText('\u25b2', cw / 2, 320);
            ctx.fillStyle = 'rgba(79,195,247,0.3)';
            ctx.font      = '12px Arial';
            ctx.fillText('Tu nave', cw / 2, 342);

        } else if (step === 1) {
            /* Paso 2: Objetivos */
            _tutorialBlock(ctx, cw / 2, 118, '\u2714 Objetivo',
                'Elimina todos los enemigos antes de\nque lleguen a tu zona de defensa.');
            _tutorialBlock(ctx, cw / 2, 210, '\u2665 Vidas',
                'Tienes ' + CONFIG.PLAYER_LIFE + ' vidas.\nPierdes 1 si un enemigo te dispara\no cruza la pantalla sin ser eliminado.');
            _tutorialBlock(ctx, cw / 2, 320, '\u2605 Puntuaci\u00f3n',
                'Cada enemigo da puntos al morir.\nAl ganar: puntos + vidas \u00d7 5.');

        } else {
            /* Paso 3: Tipos de enemigos con color por tipo */
            var enemies = [
                { label: 'NORMAL',  color: '#88ccff', desc: 'Movimiento lateral est\u00e1ndar.  +' + (5) + ' pts' },
                { label: 'R\u00c1PIDO',  color: '#ffaa44', desc: 'Baja en l\u00ednea recta, sin desviar.  +8 pts' },
                { label: 'ZIGZAG',  color: '#cc88ff', desc: 'Movimiento sinusoidal impredecible.  +10 pts' },
                { label: '\u26a0 JEFE',   color: '#ff4455', desc: '12 vidas, 2 fases, embestidas.  +50 pts' }
            ];
            for (var e = 0; e < enemies.length; e++) {
                var ey = 115 + e * 110;
                /* Badge de color por tipo (RP 029) */
                ctx.fillStyle   = enemies[e].color;
                ctx.strokeStyle = enemies[e].color;
                ctx.lineWidth   = 1;
                roundRect(ctx, cw / 2 - 200, ey, 80, 22, 4);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font      = 'bold 11px Arial';
                ctx.fillText(enemies[e].label, cw / 2 - 160, ey + 15);
                /* Descripción */
                ctx.fillStyle = '#ddd';
                ctx.font      = '13px Arial';
                ctx.textAlign = 'left';
                ctx.fillText(enemies[e].desc, cw / 2 - 108, ey + 15);
                ctx.textAlign = 'center';
                /* Separador */
                if (e < enemies.length - 1) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
                    ctx.beginPath();
                    ctx.moveTo(cw / 2 - 205, ey + 32);
                    ctx.lineTo(cw / 2 + 205, ey + 32);
                    ctx.stroke();
                }
            }
        }

        /* ── Botón de navegación ── */
        var isLast  = (step === totalSteps - 1);
        var btnLabel = isLast ? '\u25b6  JUGAR' : 'SIGUIENTE \u203a';
        var btnColor = isLast ? '#27ae60' : '#e94560';

        ctx.fillStyle   = btnColor;
        ctx.strokeStyle = btnColor;
        ctx.lineWidth   = 2;
        roundRect(ctx, cw / 2 - 90, ch - 72, 180, 38, 8);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'white';
        ctx.font      = 'bold 16px Arial';
        ctx.fillText(btnLabel, cw / 2, ch - 47);

        /* Hint de tecla */
        ctx.fillStyle = 'rgba(150,150,150,0.8)';
        ctx.font      = '12px Arial';
        ctx.fillText('o pulsa P', cw / 2, ch - 22);

        ctx.textAlign = 'left';
    }

    /* Helper: fila de control con tecla + descripción */
    function _tutorialRow(ctx, cx, y, key, desc, color) {
        /* Caja de tecla */
        ctx.fillStyle   = 'rgba(255,255,255,0.1)';
        ctx.strokeStyle = color;
        ctx.lineWidth   = 1.5;
        roundRect(ctx, cx - 190, y - 18, 70, 26, 5);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font      = 'bold 14px Arial';
        ctx.fillText(key, cx - 155, y);
        /* Descripción */
        ctx.fillStyle = '#ddd';
        ctx.font      = '13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(desc, cx - 106, y);
        ctx.textAlign = 'center';
    }

    /* Helper: bloque de texto con título e icono */
    function _tutorialBlock(ctx, cx, y, title, text) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(ctx, cx - 210, y, 420, 76, 8);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText(title, cx, y + 20);
        ctx.fillStyle = '#ccc';
        ctx.font      = '13px Arial';
        var lines = text.split('\n');
        for (var l = 0; l < lines.length; l++) {
            ctx.fillText(lines[l], cx, y + 40 + l * 18);
        }
    }

    /* ── Overlay de pausa (RP 006) ──────────────────────────────────────── */
    function drawPauseScreen() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var cw  = gs.canvas.width;
        var ch  = gs.canvas.height;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, cw, ch);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.font      = 'bold 38px Arial';
        ctx.fillText('PAUSA', cw / 2, ch / 2 - 30);

        ctx.fillStyle = 'rgba(180, 180, 180, 0.85)';
        ctx.font      = '14px Arial';
        ctx.fillText('Pulsa P o el bot\u00f3n para continuar', cw / 2, ch / 2 + 8);

        /* Botón Menú principal */
        ctx.fillStyle   = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = '#888';
        ctx.lineWidth   = 1;
        roundRect(ctx, cw / 2 - 90, ch / 2 + 40, 180, 38, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ccc';
        ctx.font      = 'bold 14px Arial';
        ctx.fillText('\uD83C\uDFE0  Men\u00FA principal', cw / 2, ch / 2 + 64);

        ctx.textAlign = 'left';
    }

    /* ── Game Over (RP 026) ─────────────────────────────────────────────── */
    function drawGameOver() {
        var gs  = GameState;
        var ctx = gs.bufferctx;
        var cw  = gs.canvas.width;
        var ch  = gs.canvas.height;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, cw, ch);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#e94560';
        ctx.font      = 'bold 48px Arial';
        ctx.fillText('GAME OVER', cw / 2, ch / 2 - 30);

        ctx.fillStyle = 'white';
        ctx.font      = 'bold 18px Arial';
        ctx.fillText('Puntuaci\u00f3n final: ' + gs.player.score, cw / 2, ch / 2 + 10);
        ctx.textAlign = 'left';
    }

    /* ── Victoria (RP 019) ──────────────────────────────────────────────── */
    function drawCongratulations() {
        var gs    = GameState;
        var ctx   = gs.bufferctx;
        var p     = gs.player;
        var cw    = gs.canvas.width;
        var ch    = gs.canvas.height;
        var total = p.score + p.life * 5;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, cw, ch);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgb(204, 50, 153)';
        ctx.font      = 'bold 26px Arial';
        ctx.fillText('\u00a1Te has pasado el juego!', cw / 2, ch / 2 - 70);

        ctx.font = 'bold 17px Arial';
        ctx.fillStyle = '#eaeaea';
        ctx.fillText('Puntos en juego : ' + p.score,          cw / 2, ch / 2 - 32);
        ctx.fillText('Vidas restantes  : ' + p.life + ' \u00d7 5', cw / 2, ch / 2 - 8);

        ctx.fillStyle = '#FFD700';
        ctx.fillText('Bonus supervivencia: +' + (p.life * 5), cw / 2, ch / 2 + 18);

        ctx.fillStyle = 'white';
        ctx.font      = 'bold 20px Arial';
        ctx.fillText('PUNTUACI\u00d3N TOTAL: ' + total,         cw / 2, ch / 2 + 54);
        ctx.textAlign = 'left';
    }

    /* ── Volcado del buffer + borde temático in-game ────────────────────── */
    function flush() {
        var gs = GameState;
        gs.ctx.drawImage(gs.buffer, 0, 0);

        /* Borde del canvas con el acento del tema — visible en todo momento */
        var theme = getThemeColors();
        gs.ctx.strokeStyle = theme.accent;
        gs.ctx.lineWidth   = 3;
        gs.ctx.strokeRect(1, 1, gs.canvas.width - 2, gs.canvas.height - 2);
    }

    /* ── Helper: rectángulo con bordes redondeados ──────────────────────── */
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    /* ── API pública ────────────────────────────────────────────────────── */
    return {
        drawBackground      : drawBackground,
        drawHUD             : drawHUD,
        drawPlayer          : drawPlayer,
        drawEvil            : drawEvil,
        drawImpactParticles : drawImpactParticles,
        drawEvilHealthBar   : drawEvilHealthBar,
        drawRewardMessage   : drawRewardMessage,
        drawStartScreen     : drawStartScreen,
        drawOptionsMenu     : drawOptionsMenu,
        drawInstructions    : drawInstructions,
        drawPauseScreen     : drawPauseScreen,
        drawGameOver        : drawGameOver,
        drawCongratulations : drawCongratulations,
        getThemeColors      : getThemeColors,
        flush               : flush
    };

})();