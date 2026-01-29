// State
let direction = 1; // 1 for Buy, -1 for Sell

// DOM Elements
const inputs = document.querySelectorAll('input, select');
const elSl = document.getElementById('slResult');
const elTp = document.getElementById('tpResult');
const elSlPips = document.getElementById('slPips'); // NEW
const elTpPips = document.getElementById('tpPips'); // NEW
const elPair = document.getElementById('pairSelect');
const elLot = document.getElementById('lotSize');

// Load saved settings
if(localStorage.getItem('fk_last_lot')) elLot.value = localStorage.getItem('fk_last_lot');
if(localStorage.getItem('fk_last_pair')) elPair.value = localStorage.getItem('fk_last_pair');

// Listeners
inputs.forEach(input => input.addEventListener('input', calculate));
elPair.addEventListener('change', () => {
    localStorage.setItem('fk_last_pair', elPair.value);
    calculate();
});
elLot.addEventListener('change', () => {
    localStorage.setItem('fk_last_lot', elLot.value);
    calculate();
});

// Toggle Tooltip
function toggleTooltip(el) {
    document.querySelectorAll('.tooltip-container').forEach(c => {
        if(c !== el) c.classList.remove('active');
    });
    el.classList.toggle('active');
    
    if(el.classList.contains('active')) {
        setTimeout(() => el.classList.remove('active'), 3000);
    }
}

function setDirection(dir) {
    direction = dir;
    const btns = document.querySelectorAll('.dir-btn');
    btns[0].classList.toggle('active', dir === 1);
    btns[1].classList.toggle('active', dir === -1);
    calculate();
}

function calculate() {
    const lots = parseFloat(document.getElementById('lotSize').value);
    const risk = parseFloat(document.getElementById('riskAmount').value);
    const reward = parseFloat(document.getElementById('rewardAmount').value);
    const open = parseFloat(document.getElementById('openPrice').value);
    const pair = document.getElementById('pairSelect').value;

    if (!lots || !risk || !reward || !open) {
        elSl.innerText = "---";
        elTp.innerText = "---";
        elSlPips.innerText = "0.0 pips";
        elTpPips.innerText = "0.0 pips";
        return;
    }

    let priceChangeSL = 0;
    let priceChangeTP = 0;
    const quoteIsUSD = ['EURUSD','GBPUSD','AUDUSD','NZDUSD'].includes(pair);
    
    // Calculate raw price movement needed
    if (quoteIsUSD) {
        priceChangeSL = risk / (lots * 100000);
        priceChangeTP = reward / (lots * 100000);
    } else {
        priceChangeSL = (risk * open) / (lots * 100000);
        priceChangeTP = (reward * open) / (lots * 100000);
    }

    // Determine Pip Size (0.01 for JPY, 0.0001 for others)
    const isJpy = pair.includes('JPY');
    const pipSize = isJpy ? 0.01 : 0.0001;
    const decimals = isJpy ? 3 : 5;

    // Calculate Final Prices
    let slPrice, tpPrice;

    if (direction === 1) { // BUY
        slPrice = open - priceChangeSL;
        tpPrice = open + priceChangeTP;
    } else { // SELL
        slPrice = open + priceChangeSL;
        tpPrice = open - priceChangeTP;
    }

    // Calculate Pip Count
    const pipsSL = priceChangeSL / pipSize;
    const pipsTP = priceChangeTP / pipSize;

    // Update DOM
    elSl.innerText = slPrice.toFixed(decimals);
    elTp.innerText = tpPrice.toFixed(decimals);
    
    // Update Pip display
    elSlPips.innerText = pipsSL.toFixed(1) + " pips";
    elTpPips.innerText = pipsTP.toFixed(1) + " pips";
}

function handleCopy(valueId, statusId) {
    const text = document.getElementById(valueId).innerText;
    if(text === "---") return;

    copyTextToClipboard(text).then(() => {
        showCopyFeedback(statusId);
    });
}

function showCopyFeedback(statusId) {
    const statusEl = document.getElementById(statusId);
    statusEl.classList.add('visible');
    setTimeout(() => {
        statusEl.classList.remove('visible');
    }, 1500);
}

async function copyTextToClipboard(text) {
    if ('clipboard' in navigator && navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (err) {
            console.error('Navigator Clipboard failed', err);
        }
    }
    
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textArea);
}