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

