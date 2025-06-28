// Funktion zum Zeichnen der Mandelbrotmenge
function drawMandelbrot(data) {
    if (!data) return;

    const { buffer, width, height } = data;
    const imageData = ctx.createImageData(width, height);
    const dataArray = imageData.data;

    // Kopieren der Daten aus dem WebAssembly-Speicher in den ImageData-Puffer
    dataArray.set(buffer);
    ctx.putImageData(imageData, 0, 0);
    lastImageData = imageData;
}

// Funktion zum Zeichnen des Auswahlrechtecks mit festem Seitenverhältnis
function drawSelectionRectangle() {
    if (isSelectingArea && selectionStartX !== undefined && selectionStartY !== undefined) {
        // Berechne die aktuelle Breite und Höhe der Auswahl
        let width = selectionWidth || 0;
        let height = selectionHeight || 0;

        // Wenn wir gerade ziehen, berechne die aktuelle Größe
        if (selectionWidth === undefined || selectionHeight === undefined) {
            const currentX = selectionEndX || selectionStartX;
            const currentY = selectionEndY || selectionStartY;

            // Berechne die Breite und Höhe basierend auf der Mausposition
            const rawWidth = currentX - selectionStartX;
            const rawHeight = currentY - selectionStartY;

            // Berechne die tatsächliche Breite und Höhe unter Berücksichtigung des Seitenverhältnisses
            if (Math.abs(rawWidth) / Math.abs(rawHeight) > windowAspectRatio) {
                // Breite ist zu groß - passe die Höhe an
                height = Math.abs(rawWidth) / windowAspectRatio;
                if (rawHeight < 0) height = -height;
            } else {
                // Höhe ist zu groß - passe die Breite an
                width = Math.abs(rawHeight) * windowAspectRatio;
                if (rawWidth < 0) width = -width;
            }
        } else {
            // Verwende die gespeicherten Werte
            width = selectionWidth;
            height = selectionHeight;
        }

        // Berechne die tatsächlichen Positionswerte
        const x = selectionStartX;
        const y = selectionStartY;
        const actualWidth = Math.abs(width);
        const actualHeight = Math.abs(height);

        // Erstelle ein temporäres Canvas für die Zeichnung
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Zeichne das Mandelbrot-Bild als Grundlage
        if (lastImageData) {
            tempCtx.putImageData(lastImageData, 0, 0);
        }

        // Zeichne das Auswahlrechteck mit dem richtigen Seitenverhältnis
        tempCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        tempCtx.lineWidth = 2;
        tempCtx.setLineDash([5, 5]);

        // Berücksichtige die Richtung (oben/unten, links/rechts)
        let rectX = x;
        let rectY = y;
        let rectWidth = actualWidth;
        let rectHeight = actualHeight;

        // Falls die Breite negativ ist (ziehen nach links)
        if (width < 0) {
            rectX = x + width; // x + negative Breite
        }

        // Falls die Höhe negativ ist (ziehen nach oben)
        if (height < 0) {
            rectY = y + height; // y + negative Höhe
        }

        tempCtx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        tempCtx.setLineDash([]);

        // Übertrage das temporäre Canvas auf das Hauptcanvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
    }
}

// Funktion zum Aktualisieren der Auswahl während des Ziehens
function updateSelection(x, y) {
    if (!isSelectingArea) return;

    // Berechne die Breite und Höhe basierend auf der Mausposition
    const rawWidth = x - selectionStartX;
    const rawHeight = y - selectionStartY;

    // Berechne die tatsächliche Breite und Höhe unter Berücksichtigung des Seitenverhältnisses
    let width, height;

    if (Math.abs(rawWidth) / Math.abs(rawHeight) > windowAspectRatio) {
        // Breite ist zu groß - passe die Höhe an
        height = Math.abs(rawWidth) / windowAspectRatio;
        if (rawHeight < 0) height = -height;
        width = rawWidth;
    } else {
        // Höhe ist zu groß - passe die Breite an
        width = Math.abs(rawHeight) * windowAspectRatio;
        if (rawWidth < 0) width = -width;
        height = rawHeight;
    }

    // Aktualisiere die Endposition
    selectionEndX = selectionStartX + width;
    selectionEndY = selectionStartY + height;

    // Aktualisiere die gespeicherten Breite/Höhe
    selectionWidth = width;
    selectionHeight = height;

    // Zeichne das Auswahlrechteck neu
    drawSelectionRectangle();
}

// Funktion zum Ändern der Canvas-Größe
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Aktualisiere das Seitenverhältnis
    windowAspectRatio = canvas.width / canvas.height;

    // Falls wir gerade eine Auswahl treffen, aktualisiere die Auswahl
    if (isSelectingArea && selectionStartX !== undefined) {
        // Berechne die neue Endposition basierend auf dem aktuellen Seitenverhältnis
        const x = selectionEndX || selectionStartX;
        const y = selectionEndY || selectionStartY;
        updateSelection(x, y);
    }

    renderMandelbrot();
}

// Funktion zur Sperrung der UI während des Renderns
function lockUI() {
    console.log("Locking UI...");  // Debug-Ausgabe
    isRendering = true;
    renderStartTime = Date.now();

    // Deaktivieren der UI-Elemente
    backButton.disabled = true;
    homeButton.disabled = true;
    document.querySelectorAll('input[name="gradient"]').forEach(input => {
        input.disabled = true;
    });
    iterationsSlider.disabled = true;

    // Erstellen der Überlagerung mit den vordefinierten IDs und Klassen
    const overlay = document.createElement('div');
    overlay.id = 'renderOverlay';
    if (overlay) {
        console.log("Creating render overlay...");  // Debug-Ausgabe
    }

    // Erstellen des Fortschrittstexts
    const progressText = document.createElement('div');
    progressText.id = 'renderProgress';
    progressText.textContent = 'Berechne ... (0.0s)';

    // Erstellen des Spinners
    const spinner = document.createElement('div');
    spinner.id = 'renderSpinner';

    // Zusammenbauen der Überlagerung
    overlay.appendChild(progressText);
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);

    // Starten der Fortschrittsaktualisierung
    updateRenderProgress();
}



// Funktion zur Freigabe der UI nach dem Rendern
function unlockUI() {
    console.log("Unlocking UI...");  // Debug-Ausgabe
    isRendering = false;

    // Alle Buttons wieder aktivieren
    backButton.disabled = false;
    homeButton.disabled = false;
    document.querySelectorAll('input[name="gradient"]').forEach(input => {
        input.disabled = false;
    });
    iterationsSlider.disabled = false;

    // Überlagerung entfernen
    const overlay = document.getElementById('renderOverlay');
    if (overlay) {
        console.log("Removing overlay...");  // Debug-Ausgabe
        overlay.remove();
    }

    // Animation-Stil entfernen
    const style = document.querySelector('style[textContent*="@keyframes spin"]');
    if (style) {
        style.remove();
    }
}

// Funktion zur Aktualisierung des Fortschritts
function updateRenderProgress() {
    if (!isRendering) return;

    const progressText = document.getElementById('renderProgress');
    if (progressText) {
        const elapsed = (Date.now() - renderStartTime) / 1000;
        progressText.textContent = `Berechne ... (${elapsed.toFixed(1)}s)`;

        // Planen Sie die nächste Aktualisierung
        if (isRendering) {
            requestAnimationFrame(updateRenderProgress);
        }
    }
}

// Funktion zum Zurücksetzen auf die Anfangsansicht (Home)
function resetToHomeView() {
    centerX = -0.8;
    centerY = 0.0;
    sectionHeight = 2.2;
    zoomFactor = 1.0;

    // Geschichte zurücksetzen
    history = [];

    renderMandelbrot();
}


// Initialisierung
function init() {
    // Fenstergröße und Seitenverhältnis setzen
    windowAspectRatio = window.innerWidth / window.innerHeight;
    resizeCanvas();

    // Event-Listener für Fenstergrößenänderungen
    window.addEventListener('resize', () => {
        // Aktualisiere das Seitenverhältnis
        windowAspectRatio = window.innerWidth / window.innerHeight;
        resizeCanvas();
    });
}

