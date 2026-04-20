/**
 * scores.js
 * Gestión de las mejores puntuaciones usando localStorage.
 * RP 010: incluye nombre del jugador en cada entrada.
 * RP 025: resalta visualmente el high score actual.
 *
 * Depende de: utils.js, config.js
 */

var Scores = (function () {

    /* ── Calcular puntuación total (juego + bonus de vidas) ── */
    function getTotalScore() {
        var p = GameState.player;
        return p.score + p.life * 5;
    }

    /* ── RP 010: clave = "nombre | fecha" para identificar al jugador ── */
    function getScoreKey() {
        var d    = new Date();
        var name = (GameState.playerName || 'Anónimo').trim();
        var date = fillZero(d.getDay() + 1) + '/' +
                   fillZero(d.getMonth() + 1) + '/' +
                   d.getFullYear() + ' ' +
                   fillZero(d.getHours()) + ':' +
                   fillZero(d.getMinutes()) + ':' +
                   fillZero(d.getSeconds());
        return name + ' | ' + date;
    }

    /* ── Obtener todas las puntuaciones almacenadas ── */
    function getAllScores() {
        var all = [];
        for (var i = 0; i < localStorage.length; i++) {
            all.push(localStorage.getItem(localStorage.key(i)));
        }
        return all;
    }

    /* ── RP 025: obtener el valor numérico del high score actual ── */
    function getHighScore() {
        var scores = getAllScores();
        if (scores.length === 0) return 0;
        return Math.max.apply(null, scores.map(function(s) { return parseInt(s) || 0; }));
    }

    /* ── Obtener las claves de las N mejores puntuaciones ── */
    function getBestScoreKeys() {
        var scores = getAllScores();
        scores.sort(function (a, b) { return b - a; });
        scores = scores.slice(0, CONFIG.BEST_SCORES_COUNT);

        var keys = [];
        for (var j = 0; j < scores.length; j++) {
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (parseInt(localStorage.getItem(key)) === parseInt(scores[j])) {
                    if (!keys.containsElement(key)) keys.push(key);
                    break;
                }
            }
        }
        return keys.slice(0, CONFIG.BEST_SCORES_COUNT);
    }

    /* ── Eliminar puntuaciones que no estén en el top N ── */
    function removeOldScores() {
        var best     = getBestScoreKeys();
        var toRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!best.containsElement(key)) toRemove.push(key);
        }
        for (var j = 0; j < toRemove.length; j++) {
            localStorage.removeItem(toRemove[j]);
        }
    }

    /* ── Renderizar la lista de puntuaciones en el DOM ── */
    function renderBestScores() {
        var list = document.getElementById('puntuaciones');
        if (!list) return;

        var highScore = getHighScore();

        list.innerHTML = '';
        var addItem = function (content, cls) {
            var li = document.createElement('li');
            if (cls) li.setAttribute('class', cls);
            li.innerHTML = content;
            list.appendChild(li);
        };

        /* Cabecera */
        addItem('Jugador / Fecha');   /* RP 010: columna jugador */
        addItem('Puntos');

        var best = getBestScoreKeys();
        for (var i = 0; i < best.length; i++) {
            var key   = best[i];
            var score = parseInt(localStorage.getItem(key));

            /* RP 025: resaltar el high score con clase especial */
            var isTop = (score === highScore && i === 0);
            var cls   = isTop ? 'negrita high-score' : (i === 0 ? 'negrita' : null);

            /* RP 010: separar nombre de fecha en la clave */
            var parts    = key.split(' | ');
            var keyLabel = parts.length === 2
                ? '<span class="score-name">' + parts[0] + '</span><br><small>' + parts[1] + '</small>'
                : key;

            addItem(keyLabel, cls);
            /* RP 025: corona al high score */
            addItem((isTop ? '\uD83C\uDFC6 ' : '') + score, cls);
        }
    }

    /* ── Guardar puntuación al finalizar la partida ── */
    function saveFinalScore() {
        localStorage.setItem(getScoreKey(), getTotalScore());
        renderBestScores();
        removeOldScores();
    }

    /* ── API pública ── */
    return {
        getTotalScore    : getTotalScore,
        getHighScore     : getHighScore,
        saveFinalScore   : saveFinalScore,
        renderBestScores : renderBestScores
    };

})();
