/**
 * sounds.js
 * RP 015 – Efectos de sonido del juego.
 *
 * ACTUALMENTE: sonidos generados por código con Web Audio API.
 *
 * CÓMO REEMPLAZAR POR ARCHIVOS LOCALES:
 * ─────────────────────────────────────
 * 1. Coloca tus archivos de audio en:  audio/disparo.mp3, audio/impacto.mp3, etc.
 * 2. En cada función (ej. Sounds.shoot), comenta la línea "synth_*()" y
 *    descomenta la línea "playFile(...)".
 * 3. Ejemplo:
 *
 *    shoot: function() {
 *        if (!GameState.soundEnabled) return;
 *        // playFile('audio/disparo.mp3');   // ← descomentar para usar archivo
 *        synth_shoot();                      // ← comentar para dejar de usar síntesis
 *    }
 *
 * Depende de: config.js (GameState.soundEnabled)
 */

var Sounds = (function () {

    /* ─── Contexto de Audio ─────────────────────────────────────────────── */
    var _ctx = null;

    function getCtx() {
        if (!_ctx) {
            _ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return _ctx;
    }

    /* ─── Helper: reproducir archivo local (listo para usar) ───────────── */
    /**
     * Reproduce un archivo de audio local.
     * Descomenta las llamadas a esta función en cada evento para usarla.
     * @param {string} src  Ruta relativa al archivo, ej: 'audio/disparo.mp3'
     * @param {number} [volume=1]  Volumen entre 0 y 1
     */
    function playFile(src, volume) {
        var audio = new Audio(src);
        audio.volume = (volume !== undefined) ? volume : 1;
        audio.play().catch(function() { /* autoplay bloqueado: ignorar */ });
    }

    /* ─── Síntesis procedural ───────────────────────────────────────────── */

    /**
     * Genera un tono simple.
     * @param {string} type      Tipo de onda: 'sine'|'square'|'sawtooth'|'triangle'
     * @param {number} freq      Frecuencia inicial en Hz
     * @param {number} duration  Duración en segundos
     * @param {number} [gainVal] Volumen (0–1), default 0.3
     * @param {number} [freqEnd] Frecuencia final (para sweep), default = freq
     */
    function tone(type, freq, duration, gainVal, freqEnd) {
        var ac   = getCtx();
        var osc  = ac.createOscillator();
        var gain = ac.createGain();

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.type            = type;
        osc.frequency.value = freq;
        if (freqEnd !== undefined) {
            osc.frequency.linearRampToValueAtTime(freqEnd, ac.currentTime + duration);
        }

        gain.gain.setValueAtTime(gainVal || 0.3, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + duration);
    }

    /* Disparo del jugador: pitido corto ascendente */
    function synth_shoot() {
        tone('square', 440, 0.08, 0.18, 880);
    }

    /* Impacto en enemigo: clic seco descendente */
    function synth_hit() {
        tone('sawtooth', 320, 0.12, 0.25, 80);
    }

    /* Muerte del jugador: descenso largo dramático */
    function synth_playerDeath() {
        tone('sawtooth', 400, 0.5,  0.35, 60);
        setTimeout(function() { tone('sine', 200, 0.4, 0.2, 50); }, 150);
    }

    /* Enemigo eliminado: subida rápida tipo "ping" */
    function synth_enemyKill() {
        tone('sine', 300, 0.08, 0.3, 700);
        setTimeout(function() { tone('sine', 700, 0.12, 0.2, 1000); }, 60);
    }

    /* Victoria: melodía corta ascendente */
    function synth_victory() {
        var notes = [523, 659, 784, 1047];  /* Do Mi Sol Do */
        for (var i = 0; i < notes.length; i++) {
            (function(freq, delay) {
                setTimeout(function() {
                    tone('sine', freq, 0.25, 0.3);
                }, delay);
            })(notes[i], i * 150);
        }
    }

    /* Game Over: descenso grave */
    function synth_gameOver() {
        var notes = [392, 330, 277, 220];   /* Sol Fa# Re# La */
        for (var i = 0; i < notes.length; i++) {
            (function(freq, delay) {
                setTimeout(function() {
                    tone('sawtooth', freq, 0.3, 0.28);
                }, delay);
            })(notes[i], i * 200);
        }
    }

    /* Transición a fase 2 del jefe: alarma */
    function synth_bossPhase2() {
        tone('square', 150, 0.15, 0.4, 300);
        setTimeout(function() { tone('square', 300, 0.15, 0.4, 150); }, 160);
        setTimeout(function() { tone('square', 150, 0.15, 0.4, 300); }, 320);
    }

    /* Pausa: clic neutro */
    function synth_pause() {
        tone('sine', 600, 0.08, 0.15);
    }

    /* ─── API pública ───────────────────────────────────────────────────── */
    return {

        /**
         * Disparo del jugador.
         * Reemplazar: playFile('audio/disparo.mp3', 0.5)
         */
        shoot: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/disparo.mp3', 0.5);
            synth_shoot();
        },

        /**
         * Impacto en enemigo (sin eliminar).
         * Reemplazar: playFile('audio/impacto.mp3', 0.6)
         */
        hit: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/impacto.mp3', 0.6);
            synth_hit();
        },

        /**
         * Enemigo eliminado.
         * Reemplazar: playFile('audio/enemigo_muerto.mp3', 0.7)
         */
        enemyKill: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/enemigo_muerto.mp3', 0.7);
            synth_enemyKill();
        },

        /**
         * Jugador pierde una vida.
         * Reemplazar: playFile('audio/jugador_muerto.mp3', 0.8)
         */
        playerDeath: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/jugador_muerto.mp3', 0.8);
            synth_playerDeath();
        },

        /**
         * Victoria (todos los enemigos eliminados).
         * Reemplazar: playFile('audio/victoria.mp3', 0.9)
         */
        victory: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/victoria.mp3', 0.9);
            synth_victory();
        },

        /**
         * Game Over.
         * Reemplazar: playFile('audio/game_over.mp3', 0.9)
         */
        gameOver: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/game_over.mp3', 0.9);
            synth_gameOver();
        },

        /**
         * Jefe entra en fase 2.
         * Reemplazar: playFile('audio/jefe_fase2.mp3', 0.8)
         */
        bossPhase2: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/jefe_fase2.mp3', 0.8);
            synth_bossPhase2();
        },

        /**
         * Pausa / reanudación.
         * Reemplazar: playFile('audio/pausa.mp3', 0.4)
         */
        pause: function () {
            if (!GameState.soundEnabled) return;
            // playFile('audio/pausa.mp3', 0.4);
            synth_pause();
        }
    };

})();
