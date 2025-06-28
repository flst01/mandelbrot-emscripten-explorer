# Mandelbrot Emscripten Explorer

A web-based Mandelbrot set explorer leveraging C code compiled to WebAssembly via Emscripten.

## Overview

This project visualizes and explores the Mandelbrot set in your browser. The core computation is written in C for performance and compiled to WebAssembly using [Emscripten](https://emscripten.org/). The web interface is built with HTML and JavaScript, utilizing Web Workers for responsive, non-blocking rendering and progress updates.

## Features

- Fast Mandelbrot set calculation using WebAssembly
- Interactive zoom and pan
- Responsive UI with progress reporting via Web Workers

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/yourusername/mandelbrot-emscripten-explorer.git
    ```
2. Open `index.html` in your browser.

## Credits

The C code for Mandelbrot calculation and visualization is derived from the work of [Tobias Brückner](https://github.com/Toxe/mandelbrot-comparison/) (MIT License).
This work was heavily inspired by [The Mandelbrot Viewer web app](https://mandelbrot.silversky.dev) by [Adrian Rabenseifer](https://adrian.rabenseifner.ch/), [silversky | we implement](https://silversky.dev/). Check it out! There is a cool way to install it as a mobile app using Progressive Web App (PWA). 

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
