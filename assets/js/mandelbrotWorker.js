self.onmessage = async function(e) {
const { width, height, centerX, centerY, sectionHeight, maxIterations, gradient } = e.data;
try {
// WASM Modul laden
importScripts('mandelbrot.js');

// Warten, bis das Modul vollständig initialisiert ist
await new Promise((resolve) => {      
  if (Module.calledRun) {
    // Das Modul ist bereits gestartet.
    resolve();
  } else {
    // Warten bis onRuntimeInitialized aufgerufen wird.
    Module.onRuntimeInitialized = resolve;
  }
});

// Jetzt ist das Modul vollständig initialisiert, allocateBuffer kann sicher aufgerufen werden.
const bufferPtr = Module.ccall('allocateBuffer', 'number', ['number', 'number'], [width, height]);
const buffer = new Uint8Array(Module.HEAPU8.buffer, bufferPtr, width * height * 4);

Module.ccall(
  'calculateMandelbrot',
  'void',
  ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'string'],
  [width, height, centerX, centerY, sectionHeight, maxIterations, bufferPtr, gradient]
);

const mandelbrotData = {
  buffer: Array.from(buffer),
  width: width,
  height: height,
  bufferPtr: bufferPtr
};

self.postMessage(mandelbrotData);

} catch (error) {
self.postMessage({
error: 'Fehler im Worker: ' + error.message
});
}
};