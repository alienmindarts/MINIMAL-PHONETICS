const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', '..', 'index.html');
const IMAGENS_PATH = path.join(__dirname, '..', 'imagens');

if (!fs.existsSync(IMAGENS_PATH)) {
    fs.mkdirSync(IMAGENS_PATH, { recursive: true });
}

const html = fs.readFileSync(INDEX_PATH, 'utf-8');

// --- Helpers para extração por regex/brace counting ---

function extractBetween(source, regex, openChar = '{', closeChar = '}') {
    const match = source.match(regex);
    if (!match) return null;
    const start = match.index + match[0].lastIndexOf(openChar);
    let depth = 1; // já estamos dentro do primeiro {
    for (let i = start + 1; i < source.length; i++) {
        if (source[i] === openChar) depth++;
        else if (source[i] === closeChar) {
            depth--;
            if (depth === 0) return source.slice(start + 1, i);
        }
    }
    return null;
}

function extractBlock(source, pattern) {
    let match = source.match(pattern);
    if (!match) throw new Error('Pattern not found: ' + pattern);
    const start = match.index + match[0].lastIndexOf('{') + 1;
    let depth = 1; // já estamos dentro do primeiro {
    for (let i = start; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i);
        }
    }
    throw new Error('No matching closing brace found');
}

// --- Extrair dados do index.html ---

const dicBody = extractBetween(html, /const\s+dicionario\s*=\s*\{/);
const vapBody = extractBetween(html, /const\s+vogaisAnteriores\s*=\s*\{/);
const vpoBody = extractBetween(html, /const\s+vogaisPosteriores\s*=\s*\{/);
const convBody = extractBlock(html, /function\s+converterTextoParaSistemaMajor\s*\([^)]*\)\s*\{/);

const dicionario = eval('({' + dicBody + '})');
const vogaisAnteriores = eval('({' + vapBody + '})');
const vogaisPosteriores = eval('({' + vpoBody + '})');

const converterFn = new Function('return function(texto) { ' + convBody + ' }')();

// Verify extraction
console.log('Dicionário keys:', Object.keys(dicionario).join(','));
console.log('Vogais anteriores keys:', Object.keys(vogaisAnteriores).join(','));
console.log('Test "gato":', converterFn('gato'));
console.log('Test "casa":', converterFn('casa'));
console.log('Test "bombo":', converterFn('bombo'));

// --- Lógica de criação de grids e SVG ---

const DEFAULT_CELL_SIZE = 30;
const DEFAULT_CELL_GAP = 2;
const DEFAULT_CELL_RADIUS = 3;
const DEFAULT_COLOR_EMPTY = '#e0e0e0';
const DEFAULT_COLOR_FILLED = '#2c3e50';
const DEFAULT_COLOR_VOWEL = '#e74c3c';

function aplicarVogal(gridBase, gridVogal, estadoVogal) {
    let resultado = [...gridBase];
    for (let i = 0; i < 49; i++) {
        if (gridVogal[i] === 1) resultado[i] = estadoVogal;
    }
    return resultado;
}

function renderBlocksSVG(texto, blocoWidth, cellSize, cellGap, cellRadius, colors, showCode, showText) {
    const gridPixelSize = 7 * cellSize + 6 * cellGap;
    const captionH = 14;
    const innerGap = cellGap;
    
    const inputNormalizado = converterFn(texto);
    const blocos = inputNormalizado.match(/[A-Z]*[0-9][A-Z]*/g) || [];
    const originais = extrairOriginal(texto, blocos);
    
    const cols = blocoWidth || blocos.length;
    const rows = Math.ceil(blocos.length / cols);
    const blockGap = 15;
    const rowGap = 15;
    const canvasW = cols * gridPixelSize + (cols - 1) * blockGap;
    const canvasH = rows * (gridPixelSize + (showCode || showText ? captionH : 0)) + (rows - 1) * rowGap;
    const textColor = '#333333';
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`;
    svg += `<rect width="${canvasW}" height="${canvasH}" fill="${colors.empty}"/>`;
    
    blocos.forEach((bloco, idx) => {
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const ox = c * (gridPixelSize + blockGap);
        const oy = r * (gridPixelSize + (showCode || showText ? captionH : 0)) + r * rowGap;
        
        const numIndex = [...bloco].findIndex(ch => dicionario[ch]);
        let estadoAtual = numIndex >= 0 ? [...dicionario[bloco[numIndex]]] : Array(49).fill(0);
        
        let ordemAnterior = 0;
        let ordemPosterior = 0;
        if (numIndex >= 0) {
            for (let i = 0; i < bloco.length; i++) {
                if (i === numIndex) continue;
                const charVogal = bloco[i];
                if (i < numIndex && vogaisAnteriores[charVogal]) {
                    let estadoId = 2 + ordemAnterior;
                    if (estadoId > 5) estadoId = 5;
                    estadoAtual = aplicarVogal(estadoAtual, vogaisAnteriores[charVogal], estadoId);
                    ordemAnterior++;
                } else if (i > numIndex && vogaisPosteriores[charVogal]) {
                    let estadoId = 2 + ordemPosterior;
                    if (estadoId > 5) estadoId = 5;
                    estadoAtual = aplicarVogal(estadoAtual, vogaisPosteriores[charVogal], estadoId);
                    ordemPosterior++;
                }
            }
        }
        
        for (let i = 0; i < 49; i++) {
            const cx = ox + (i % 7) * (cellSize + innerGap);
            const cy = oy + Math.floor(i / 7) * (cellSize + innerGap);
            const estado = estadoAtual[i];
            
            if (estado === 1) {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.filled}"/>`;
            } else if (estado === 2) {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.vowel}"/>`;
            } else {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.empty}"/>`;
            }
            
            if (estado === 2 || estado === 3 || estado === 4) {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" fill="none" stroke="${colors.vowel}" stroke-width="3"/>`;
            }
            if (estado === 3 || estado === 4) {
                svg += `<line x1="${cx}" y1="${cy}" x2="${cx+cellSize}" y2="${cy+cellSize}" stroke="${colors.vowel}" stroke-width="2"/>`;
            }
            if (estado === 4) {
                svg += `<line x1="${cx+cellSize}" y1="${cy}" x2="${cx}" y2="${cy+cellSize}" stroke="${colors.vowel}" stroke-width="2"/>`;
            }
        }
        
        if (showCode) {
            svg += `<text x="${ox + gridPixelSize/2}" y="${oy + gridPixelSize + 12}" text-anchor="middle" font-family="monospace" font-size="12" fill="${textColor}">(${bloco})</text>`;
        }
        if (showText) {
            const original = originais[idx] || '';
            const lineY = oy + gridPixelSize + (showCode ? captionH + 12 : 12);
            svg += `<text x="${ox + gridPixelSize/2}" y="${lineY}" text-anchor="middle" font-family="monospace" font-size="12" fill="#888888" font-style="italic">${original}</text>`;
        }
    });
    
    svg += `</svg>`;
    return svg;
}

function singleGlyphSVG(digit, cellSize, cellGap, cellRadius, colors) {
    const gridPixelSize = 7 * cellSize + 6 * cellGap;
    const innerGap = cellGap;
    const estado = dicionario[digit] || Array(49).fill(0);
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${gridPixelSize}" height="${gridPixelSize}" viewBox="0 0 ${gridPixelSize} ${gridPixelSize}">`;
    svg += `<rect width="${gridPixelSize}" height="${gridPixelSize}" fill="${colors.empty}"/>`;
    
    for (let i = 0; i < 49; i++) {
        const cx = (i % 7) * (cellSize + innerGap);
        const cy = Math.floor(i / 7) * (cellSize + innerGap);
        if (estado[i] === 1) {
            svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.filled}"/>`;
        } else {
            svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.empty}"/>`;
        }
    }
    
    svg += `</svg>`;
    return svg;
}

function extrairOriginal(bruto, blocos) {
    let charMap = [];
    for (let i = 0; i < bruto.length; i++) {
        let ch = bruto[i];
        if (ch === 'ç' || ch === 'Ç') {
            charMap.push({ orig: i, ch: '0', isCedilha: true });
            continue;
        }
        let norm = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
        if (norm.length === 1) {
            charMap.push({ orig: i, ch: norm });
        }
    }
    
    const digrafos = { 'CH': '6', 'LH': '5', 'NH': '2', 'RR': '4' };
    const consoantes = {
        'S': '0', 'Z': '0',
        'T': '1', 'D': '1',
        'N': '2',
        'M': '3',
        'R': '4',
        'L': '5',
        'J': '6', 'X': '6',
        'K': '7', 'Q': '7', 'C': '7', 'G': '7',
        'F': '8', 'V': '8',
        'P': '9', 'B': '9'
    };
    const vogais = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);
    const contextual = { 'CE': '0', 'CI': '0', 'GE': '6', 'GI': '6' };
    
    const silabas = [];
    let pos = 0;
    
    for (let bloco of blocos) {
        let startOrig = pos < charMap.length ? charMap[pos].orig : bruto.length;
        let bIdx = 0;
        
        while (bIdx < bloco.length && pos < charMap.length) {
            const bCh = bloco[bIdx];
            const cur = charMap[pos];
            
            if (!cur.isCedilha && !vogais.has(cur.ch) && !consoantes[cur.ch] && cur.ch !== 'H') {
                pos++;
                continue;
            }
            
            if (/[0-9]/.test(bCh)) {
                if (cur.isCedilha && bCh === '0') {
                    pos += 1;
                    bIdx++;
                    continue;
                }
                const nextCh = (pos + 1 < charMap.length) ? charMap[pos + 1].ch : '';
                const pair = cur.ch + nextCh;
                if (digrafos[pair] === bCh) {
                    pos += 2;
                } else if (contextual[pair] === bCh) {
                    pos += 1;
                } else {
                    pos += 1;
                }
                bIdx++;
            } else {
                pos++;
                bIdx++;
            }
        }
        
        let endOrig = pos < charMap.length ? charMap[pos].orig : bruto.length;
        silabas.push(bruto.slice(startOrig, endOrig).toLowerCase());
    }
    
    return silabas;
}

function generateAlphabetSVG(cellSize, cellGap, cellRadius, colors) {
    const gridPixelSize = 7 * cellSize + 6 * cellGap;
    const cols = 5;
    const rows = 2;
    const labelGap = 30;
    const blockGap = 25;
    const rowGap = 20;
    
    const canvasW = cols * gridPixelSize + (cols - 1) * blockGap;
    const canvasH = rows * (gridPixelSize + labelGap) + (rows - 1) * rowGap;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">`;
    svg += `<rect width="${canvasW}" height="${canvasH}" fill="${colors.empty}"/>`;
    
    const digitToConsonants = {
        '0': 'S, Z',
        '1': 'T, D',
        '2': 'N',
        '3': 'M',
        '4': 'R',
        '5': 'L',
        '6': 'J, X',
        '7': 'K, Q, C, G',
        '8': 'F, V',
        '9': 'P, B'
    };
    
    for (let d = 0; d <= 9; d++) {
        const r = Math.floor(d / cols);
        const c = d % cols;
        const ox = c * (gridPixelSize + blockGap);
        const oy = r * (gridPixelSize + labelGap) + (r > 0 ? r * rowGap : 0);
        const estado = dicionario[String(d)] || Array(49).fill(0);
        
        for (let i = 0; i < 49; i++) {
            const cx = ox + (i % 7) * (cellSize + cellGap);
            const cy = oy + Math.floor(i / 7) * (cellSize + cellGap);
            if (estado[i] === 1) {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.filled}"/>`;
            } else {
                svg += `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${colors.empty}"/>`;
            }
        }
        
        // Digit label
        svg += `<text x="${ox + gridPixelSize/2}" y="${oy + gridPixelSize + 16}" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="bold" fill="${colors.filled}">${d}</text>`;
        // Consonant labels
        svg += `<text x="${ox + gridPixelSize/2}" y="${oy + gridPixelSize + 30}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#666">${digitToConsonants[String(d)]}</text>`;
    }
    
    svg += `</svg>`;
    return svg;
}

// --- Gerar SVGs ---

const colors = {
    empty: DEFAULT_COLOR_EMPTY,
    filled: DEFAULT_COLOR_FILLED,
    vowel: DEFAULT_COLOR_VOWEL
};

const cellSize = DEFAULT_CELL_SIZE;
const cellGap = DEFAULT_CELL_GAP;
const cellRadius = DEFAULT_CELL_RADIUS;

console.log('Gerando alfabeto-consoantes.svg...');
const alphabetSVG = generateAlphabetSVG(cellSize, cellGap, cellRadius, colors);
fs.writeFileSync(path.join(IMAGENS_PATH, 'alfabeto-consoantes.svg'), alphabetSVG);

const examples = [
    { word: 'gato', file: 'exemplo-gato' },
    { word: 'casa', file: 'exemplo-casa' },
    { word: 'bombo', file: 'exemplo-bombo' }
];

for (const ex of examples) {
    console.log(`Gerando ${ex.file}.svg...`);
    const svg = renderBlocksSVG(ex.word, null, cellSize, cellGap, cellRadius, colors, true, true);
    fs.writeFileSync(path.join(IMAGENS_PATH, `${ex.file}.svg`), svg);
}

// --- PNG opcional via sharp ---
async function tryGeneratePNGs() {
    try {
        const sharp = require('sharp');
        const svgFiles = ['alfabeto-consoantes.svg', 'exemplo-gato.svg', 'exemplo-casa.svg', 'exemplo-bombo.svg'];
        for (const name of svgFiles) {
            const svgPath = path.join(IMAGENS_PATH, name);
            const pngPath = svgPath.replace('.svg', '.png');
            await sharp(Buffer.from(fs.readFileSync(svgPath, 'utf-8')))
                .png()
                .toFile(pngPath);
            console.log(`Gerado ${name.replace('.svg', '.png')}`);
        }
    } catch (e) {
        console.log('sharp não instalado — PNGs não gerados (opcional)');
    }
}

tryGeneratePNGs().catch(() => {});

console.log('Concluído. SVGs em:', IMAGENS_PATH);
