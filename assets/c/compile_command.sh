emcc mandelbrot.c \
    -o ../js/mandelbrot.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="['_calculateMandelbrot', '_allocateBuffer', '_freeBuffer']" \
    -s EXPORTED_RUNTIME_METHODS="['ccall', 'cwrap', 'HEAPU8']" \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=64mb \
    -O3