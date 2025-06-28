/* Modulprüfung */
// Warten Sie, bis das WebAssembly-Modul geladen ist
Module.onRuntimeInitialized = function() {
    // Überprüfen, ob die exportierten Funktionen verfügbar sind
    if (!Module._calculateMandelbrot) {
        showError('Fehler: Die Funktion calculateMandelbrot ist nicht exportiert oder nicht verfügbar.');
        return;
    }
    if (!Module._allocateBuffer) {
        showError('Fehler: Die Funktion allocateBuffer ist nicht exportiert oder nicht verfügbar.');
        return;
    }
    if (!Module._freeBuffer) {
        showError('Fehler: Die Funktion freeBuffer ist nicht exportiert oder nicht verfügbar.');
        return;
    }

    // Überprüfen, ob HEAPU8 verfügbar ist
    if (!Module.HEAPU8) {
        showError('Fehler: HEAPU8 ist nicht verfügbar. Stellen Sie sicher, dass es exportiert wurde.');
        return;
    }

    init();
};

// Überprüfen, ob das WebAssembly-Modul geladen werden konnte
if (typeof Module === 'undefined') {
    showError('Fehler: Das WebAssembly-Modul konnte nicht geladen werden.');
}

/* Initialisierung des JavaScripts */
const canvas = document.getElementById('mandelbrotCanvas');
const ctx = canvas.getContext('2d');
const errorOutput = document.getElementById('errorOutput');
const backButton = document.getElementById('backButton');
const homeButton = document.getElementById('homeButton');
const instructions = document.getElementById('instructions');
const iterationsSlider = document.getElementById('iterationsSlider');
const iterationsValue = document.getElementById('iterationsValue');

let centerX = -0.8;
let centerY = 0.0;
let sectionHeight = 2.2;
let zoomFactor = 1.0;
let isDragging = false;
let lastX, lastY;
let isSelectingArea = false;
let selectionStartX, selectionStartY;
let selectionWidth, selectionHeight;
let windowAspectRatio = 1.0;
let history = [];
let currentGradient = "benchmark";
let lastBufferPtr = null;
let lastImageData = null;
let maxIterations = 100;
let isRendering = false;
let renderStartTime = 0;


/* Funktionen */
function showError(message) {
    errorOutput.textContent = message;
    console.error(message);
}

// Funktion zur Berechnung der Mandelbrotmenge
async function calculateMandelbrotData() {
    try {
        const width = canvas.width;
        const height = canvas.height;

        // Überprüfen, ob das WebAssembly-Modul geladen ist
        if (!Module) {
            throw new Error('WebAssembly-Modul ist nicht geladen.');
        }

        // Allokieren von Speicher für die Bilddaten in WebAssembly
        const bufferPtr = Module.ccall('allocateBuffer', 'number', ['number', 'number'], [width, height]);
        if (!bufferPtr) {
            throw new Error('Fehler beim Allokieren des Speichers im WebAssembly-Modul.');
        }

        // Überprüfen, ob HEAPU8 verfügbar ist
        if (!Module.HEAPU8) {
            throw new Error("HEAPU8 ist nicht verfügbar.");
        }

        const buffer = new Uint8Array(Module.HEAPU8.buffer, bufferPtr, width * height * 4);

        // Aufruf der Mandelbrot-Berechnungsfunktion in WebAssembly
        Module.ccall(
            'calculateMandelbrot',
            'void',
            ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'string'],
            [width, height, centerX, centerY, sectionHeight, maxIterations, bufferPtr, gradients[currentGradient]]
        );

        return {
            bufferPtr: bufferPtr,
            buffer: buffer,
            width: width,
            height: height
        };
    } catch (error) {
        showError('Fehler bei der Berechnung der Mandelbrotmenge: ' + error.message);
        return null;
    }
}


/* Hauptthread Code */
async function renderMandelbrot() {
    if (isRendering) return;

    lockUI();

    try {
        const width = canvas.width;
        const height = canvas.height;

        // Worker erstellen (jeder Render-Vorgang könnte einen neuen Worker erstellen)
        const worker = new Worker('assets/js/mandelbrotWorker.js');

        // Nachrichtenhandler für den Worker
        worker.onmessage = function(e) {
            if (e.data.error) {
                showError(e.data.error);
                unlockUI();
                return;
            }

            const { buffer, width, height, bufferPtr } = e.data;

            // Erstellen der ImageData und Zeichnen der Mandelbrotmenge
            const imageData = ctx.createImageData(width, height);
            const dataArray = imageData.data;

            // Kopieren der Daten aus dem Worker in den ImageData-Puffer
            for (let i = 0; i < buffer.length; i++) {
                dataArray[i] = buffer[i];
            }

            ctx.putImageData(imageData, 0, 0);
            lastImageData = imageData;


            // Speicher freigeben
            if (lastBufferPtr) {
                Module.ccall('freeBuffer', 'void', ['number'], [lastBufferPtr]);
            }
            lastBufferPtr = bufferPtr;

            unlockUI();

            // Worker beenden, da er nach der Berechnung nicht mehr benötigt wird
            worker.terminate();
        };

        worker.onerror = function(error) {
            showError('Fehler im Worker: ' + error.message);
            unlockUI();
            worker.terminate();
        };

        // Senden der Daten an den Web Worker
        worker.postMessage({
            width,
            height,
            centerX,
            centerY,
            sectionHeight,
            maxIterations,
            gradient: gradients[currentGradient]
        });

    } catch (error) {
        showError('Fehler beim Rendern: ' + error.message);
        unlockUI();
    }
}



