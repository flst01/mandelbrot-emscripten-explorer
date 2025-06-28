/* Event Handler */
// Event-Handler für Mausklicks
canvas.addEventListener('mousedown', (event) => {
    // Speichern des aktuellen Zustands im Verlauf
    history.push({
        centerX: centerX,
        centerY: centerY,
        sectionHeight: sectionHeight,
        zoomFactor: zoomFactor,
        gradient: currentGradient,
        maxIterations: maxIterations
    });

    isDragging = false;
    isSelectingArea = true;
    selectionStartX = event.clientX - canvas.getBoundingClientRect().left;
    selectionStartY = event.clientY - canvas.getBoundingClientRect().top;
    selectionEndX = selectionStartX;
    selectionEndY = selectionStartY;
    selectionWidth = undefined;
    selectionHeight = undefined;

    // Zeichne den Startpunkt des Auswahlrechtecks
    drawSelectionRectangle();
});

// Event-Handler für Mausbewegungen
canvas.addEventListener('mousemove', (event) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    if (isSelectingArea) {
        const x = event.clientX - canvas.getBoundingClientRect().left;
        const y = event.clientY - canvas.getBoundingClientRect().top;
        updateSelection(x, y);
    }
});

// Event-Handler für Mausup (Ende der Auswahl)
canvas.addEventListener('mouseup', (event) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    if (isSelectingArea) {
        isSelectingArea = false;

        // Berechnen der neuen Zentrumskoordinaten und der neuen Höhe
        const width = canvas.width;
        const height = canvas.height;
        const sectionWidth = sectionHeight * (width / height); // Aktuelles Seitenverhältnis

        // Berechne die tatsächlichen Koordinaten des Auswahlrechtecks
        const rectX = selectionWidth < 0 ? selectionStartX + selectionWidth : selectionStartX;
        const rectY = selectionHeight < 0 ? selectionStartY + selectionHeight : selectionStartY;
        const rectWidth = Math.abs(selectionWidth);
        const rectHeight = Math.abs(selectionHeight);

        // Berechne die normalisierten Koordinaten (0-1 Bereich)
        const normX = rectX / width;
        const normY = rectY / height;
        const normWidth = rectWidth / width;
        const normHeight = rectHeight / height;

        // Originalkoordinaten der aktuellen Ansicht
        const currentSectionWidth = sectionHeight * (width / height);
        const currentStartX = centerX - currentSectionWidth / 2;
        const currentStartY = centerY + sectionHeight / 2; // Y-Achse nach unten

        // Berechne die neuen Grenzen
        const newStartX = currentStartX + (normX * currentSectionWidth);
        const newEndX = newStartX + (normWidth * currentSectionWidth);
        const newStartY = currentStartY - (normY * sectionHeight); // Y-Achse nach unten
        const newEndY = newStartY - (normHeight * sectionHeight); // Y-Achse nach unten

        // Berechnen des neuen Zentrums und der neuen Höhe
        const newCenterX = (newStartX + newEndX) / 2;
        const newCenterY = (newStartY + newEndY) / 2;
        const newSectionHeight = Math.abs(newStartY - newEndY);

        // Aktualisieren der Variablen
        centerX = newCenterX;
        centerY = newCenterY;
        sectionHeight = newSectionHeight;

        // Vollständiges Neuzeichnen der Mandelbrotmenge
        renderMandelbrot();
    }
});
// Event-Handler für Mausverlassen
canvas.addEventListener('mouseleave', () => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    isSelectingArea = false;
    //renderMandelbrot();
});

// Event-Handler für Mausrad (Zoom)
canvas.addEventListener('wheel', (event) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    const zoomIntensity = 0.1;
    const delta = event.deltaY > 0 ? 1 / (1 + zoomIntensity) : 1 + zoomIntensity;

    // Speichern des aktuellen Zustands im Verlauf
    history.push({
        centerX: centerX,
        centerY: centerY,
        sectionHeight: sectionHeight,
        zoomFactor: zoomFactor,
        gradient: currentGradient,
        maxIterations: maxIterations
    });

    zoomFactor *= delta;
    sectionHeight /= delta;
    renderMandelbrot();
    event.preventDefault();
});

// Event-Handler für den Zurück-Knopf
backButton.addEventListener('click', () => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    if (history.length > 0) {
        const previousState = history.pop();
        centerX = previousState.centerX;
        centerY = previousState.centerY;
        sectionHeight = previousState.sectionHeight;
        zoomFactor = previousState.zoomFactor;
        currentGradient = previousState.gradient;
        maxIterations = previousState.maxIterations;
        iterationsSlider.value = maxIterations;
        iterationsValue.textContent = maxIterations;
        document.querySelector(`input[name="gradient"][value="${currentGradient}"]`).checked = true;
        renderMandelbrot();
    }
});


// Event-Handler für den Home-Knopf
homeButton.addEventListener('click', () => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    resetToHomeView();
});

// Event-Listener für die Gradient-Auswahl
document.querySelectorAll('input[name="gradient"]').forEach((radio) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    radio.addEventListener('change', (event) => {
        currentGradient = event.target.value;
        renderMandelbrot();
    });
});

// Event-Listener für den Iterations-Slider - angepasst!
iterationsSlider.addEventListener('input', (event) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    // Zeige nur den aktuellen Wert an, ohne sofort neu zu rendern
    maxIterations = parseInt(event.target.value);
    iterationsValue.textContent = maxIterations;
});

// Neuer Event-Listener für das Loslassen des Sliders
iterationsSlider.addEventListener('change', (event) => {
    if (isRendering) return; // Ignoriere Eingaben während des Renderns
    // Führe das Neuzeichnen erst durch, wenn der Slider losgelassen wird
    maxIterations = parseInt(event.target.value);
    iterationsValue.textContent = maxIterations;
    renderMandelbrot();
});