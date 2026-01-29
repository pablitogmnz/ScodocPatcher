console.log(`[ScodocPatcher] Actif.`);

let observer = null;
let scodocTimeout = null;
let lastLogTime = 0;

// Configuration
const CONFIG = {
    HOST_SELECTOR: 'releve-but', // Le Web Component
    ITEM_SELECTOR: '.syntheseModule',
    UE_HEADER_SELECTOR: '.ue',
    NOTE_PATTERN: /(?:^|\s|:)(~|[0-9]{1,2}(?:[\.,][0-9]{0,2})?)(?:\s|$)/,
    COEF_PATTERN: /Coef\.?\s*(\d+)/i,
    STYLE: {
        PASS: 'color: #2ecc71; font-weight: bold;',
        FAIL: 'color: #e74c3c; font-weight: bold;'
    }
};

function parseFloatLocal(str) {
    if (!str) return null;
    return parseFloat(str.replace(',', '.'));
}

function calculateUEAverage(grades) {
    let sum = 0;
    let weightSum = 0;

    grades.forEach(g => {
        if (g.note !== null) {
            sum += g.note * g.coef;
            weightSum += g.coef;
        }
    });

    if (weightSum === 0) return null;
    return sum / weightSum;
}

function injectScore(element, average) {
    if (average === null) return;

    // Vérifier si déjà patché pour éviter de re-traiter
    if (element.getAttribute('data-scodoc-patched') === 'true') return;

    const formatted = average.toFixed(2);
    const style = average >= 10 ? CONFIG.STYLE.PASS : CONFIG.STYLE.FAIL;
    element.innerHTML = element.innerHTML.replace('~', `<span style="${style}">${formatted}</span>`);
    element.setAttribute('data-scodoc-patched', 'true');
}

function updateGeneralAverage(ueAverages) {
    const validAverages = ueAverages.filter(a => a !== null);
    if (validAverages.length === 0) return 0;

    const generalAvg = validAverages.reduce((a, b) => a + b, 0) / validAverages.length;

    // Widget Moyenne Générale
    let widget = document.getElementById('scodoc-patcher-widget');
    if (!widget) {
        widget = document.createElement('div');
        widget.id = 'scodoc-patcher-widget';
        widget.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(33, 37, 41, 0.95);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            font-family: sans-serif;
            z-index: 9999;
            text-align: center;
        `;
        document.body.appendChild(widget);
    }

    const style = generalAvg >= 10 ? '#2ecc71' : '#e74c3c';
    widget.innerHTML = `
        <div style="font-size: 0.9em; opacity: 0.8; margin-bottom: 5px;">MOYENNE GÉNÉRALE</div>
        <div style="font-size: 1.8em; font-weight: bold; color: ${style}">${generalAvg.toFixed(2)}</div>
        <div style="font-size: 0.8em; opacity: 0.6; margin-top: 5px;">${validAverages.length} UEs prises en compte</div>
    `;

    return generalAvg;
}

function scanAndCalculate() {
    // Shadow DOM Init
    const hostElement = document.querySelector(CONFIG.HOST_SELECTOR);
    if (!hostElement || !hostElement.shadowRoot) return;

    const root = hostElement.shadowRoot;
    const ueHeaders = root.querySelectorAll(CONFIG.UE_HEADER_SELECTOR);

    if (ueHeaders.length === 0) return;

    const ueResults = [];
    const ueAverages = [];
    let newPatches = 0;

    ueHeaders.forEach(header => {
        // FILTER: Ignore Bonus UEs
        if (header.classList.contains('ueBonus')) return;

        const container = header.parentElement;
        if (!container) return;

        const moyenneEl = header.querySelector('.moyenne');
        // Nom UE nettoyage
        const ueName = header.innerText.split('\n')[0].trim(); // Ex: UE4.01_D ...

        // FILTER: Double security, standard UEs start with "UE"
        if (!ueName.toUpperCase().startsWith('UE')) return;

        const modules = container.querySelectorAll(CONFIG.ITEM_SELECTOR);
        const grades = [];

        modules.forEach(mod => {
            const text = mod.innerText;
            const em = mod.querySelector('em');
            const coefText = em ? em.innerText : '';

            let textForGrade = text;
            if (em) textForGrade = text.replace(coefText, '');

            const match = textForGrade.match(CONFIG.NOTE_PATTERN);
            let note = null;
            if (match && match[1] !== '~') {
                note = parseFloatLocal(match[1]);
            }

            let coef = 1;
            const coefMatch = coefText.match(CONFIG.COEF_PATTERN);
            if (coefMatch) coef = parseInt(coefMatch[1], 10);

            grades.push({ note, coef });
        });

        const avg = calculateUEAverage(grades);
        ueAverages.push(avg);

        if (avg !== null) {
            ueResults.push({
                'UE': ueName,
                'Moyenne': avg.toFixed(2)
            });

            if (moyenneEl && moyenneEl.getAttribute('data-scodoc-patched') !== 'true') {
                injectScore(moyenneEl, avg);
                newPatches++;
            }
        }
    });

    if (ueResults.length > 0) {
        const generalAvg = updateGeneralAverage(ueAverages);

        // Log seulement si on a fait de nouveaux patchs ou pas loggé depuis longtemps (evite spam loop)
        const now = Date.now();
        if (newPatches > 0) {
            console.clear(); // Nettoie pour voir clair comme demandé
            console.log("--- Bilan ScodocPatcher ---");
            console.table(ueResults);
            console.log(`%c Moyenne Générale : ${generalAvg.toFixed(2)} `, "background: #222; color: #bada55; font-size: 16px; padding: 4px; border-radius: 4px;");
            lastLogTime = now;
        }
    }
}

// Observer sur le body pour détecter l'apparition du Web Component ou modifs
observer = new MutationObserver(() => {
    // Debounce
    if (scodocTimeout) clearTimeout(scodocTimeout);
    scodocTimeout = setTimeout(scanAndCalculate, 1000);
});

if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
} else {
    window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

// Trigger initial
setTimeout(scanAndCalculate, 1500);
