/**
 * utils.js
 * Funciones de utilidad globales: animación, arrays, timers y eventos.
 */

/* Polyfill requestAnimationFrame para compatibilidad entre navegadores */
window.requestAnimFrame = (function () {
    return window.requestAnimationFrame       ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
           window.oRequestAnimationFrame      ||
           window.msRequestAnimationFrame     ||
           function (callback) {
               window.setTimeout(callback, 1000 / 60);
           };
})();

/**
 * Elimina un elemento de un array por índice.
 * @param {Array} array
 * @param {number} from  Índice del elemento a eliminar (negativo = desde el final)
 */
var arrayRemove = function (array, from) {
    var rest = array.slice((from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
};

/**
 * Extiende Array con un método de búsqueda por valor.
 * Usado en el sistema de puntuaciones para comparar claves.
 */
Array.prototype.containsElement = function (element) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === element) return true;
    }
    return false;
};

/**
 * Agrega un cero a la izquierda si el número es menor que 10.
 * @param {number} number
 * @returns {string}
 */
function fillZero(number) {
    return (number < 10) ? '0' + number : '' + number;
}

/**
 * Registra un event listener de forma compatible con IE y navegadores modernos.
 * @param {Element} element
 * @param {string}  type
 * @param {Function} handler
 * @param {boolean} [bubbling=false]
 */
function addListener(element, type, handler, bubbling) {
    if (!element) return;
    bubbling = bubbling || false;
    if (window.addEventListener) {
        element.addEventListener(type, handler, bubbling);
    } else if (window.attachEvent) {
        element.attachEvent('on' + type, handler);
    }
}

/**
 * Número aleatorio entero entre 0 y range-1.
 * @param {number} range
 * @returns {number}
 */
function getRandomNumber(range) {
    return Math.floor(Math.random() * range);
}
