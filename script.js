// --- Game Settings & Theme Emojis ---
const THEMES = {
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🐻', '🐼', '🐯', '🐮', '🐷', '🐸', '🐵'],
    fruits: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥝'],
    foods: ['🍔', '🍟', '🍕', '🌭', '🍳', '🍿', '🍩', '🍪', '🍰', '🍦', '🍣', '🍙'],
    space: ['🚀', '🛸', '🧑‍🚀', '🪐', '🌙', '☀️', '⭐', '☄️', '🌍', '🛰️', '👽', '🌌']
};

let currentTheme = 'animals';
let deck = [];

// --- Game State Variables ---
let flippedCards = [];
let moves = 0;
let matchedPairs = 0;
let timeElapsed = 0;
let timerInterval = null;
let gameStarted = false;
let isLocked = false;
let isSoundMuted = false;

// Combo Mechanics
let comboCount = 0;
let lastMatchTime = 0;
let comboTimeout = null;

// Audio Context
let audioCtx = null;

// --- DOM Elements ---
const gameBoard = document.getElementById('gameBoard');
const boardWrapper = document.querySelector('.board-wrapper');
const timerDisplay = document.getElementById('timer');
const movesDisplay = document.getElementById('moves');
const bestScoreDisplay = document.getElementById('bestScore');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const themeSelect = document.getElementById('themeSelect');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const comboIndicator = document.getElementById('comboIndicator');

// Progress Bar Elements
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Overlay Elements
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const countdownBarFill = document.getElementById('countdownBarFill');

// Modal Elements
const winModal = document.getElementById('winModal');
const finalTimeDisplay = document.getElementById('finalTime');
const finalMovesDisplay = document.getElementById('finalMoves');
const newRecordBadge = document.getElementById('newRecordBadge');
const modalStars = document.getElementById('modalStars');
const starRatingLabel = document.getElementById('starRatingLabel');

// --- Sound Synthesizer (Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (isSoundMuted) return;
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;

    switch (type) {
        case 'countdown':
            // Short soft beep for 3, 2, 1
            osc.type = 'sine';
            osc.frequency.setValueAtTime(329.63, now); // E4
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;

        case 'countdown-start':
            // Higher pitched beep for "Start/Go"
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;

        case 'flip':
            // Soft click sound when flipping card
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(350, now);
            osc.frequency.exponentialRampToValueAtTime(650, now + 0.08);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
            break;

        case 'match':
            // Clean chime arpeggio (C5 -> E5 -> G5)
            // Make arpeggio pitch scale up based on active combo!
            const pitchMultiplier = 1 + (comboCount * 0.15); // Increase key for higher combo
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25 * pitchMultiplier, now); // C5
            osc.frequency.setValueAtTime(659.25 * pitchMultiplier, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99 * pitchMultiplier, now + 0.16); // G5
            
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.setValueAtTime(0.1, now + 0.08);
            gain.gain.setValueAtTime(0.12, now + 0.16);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            
            osc.start(now);
            osc.stop(now + 0.4);
            break;

        case 'mismatch':
            // Short buzzer down-sweep
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.linearRampToValueAtTime(110, now + 0.2);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
            break;

        case 'victory':
            // Playful arpeggiated fanfare
            const melody = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00];
            melody.forEach((freq, idx) => {
                const subOsc = audioCtx.createOscillator();
                const subGain = audioCtx.createGain();
                subOsc.connect(subGain);
                subGain.connect(audioCtx.destination);
                
                subOsc.type = 'sine';
                subOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
                
                subGain.gain.setValueAtTime(0.08, now + idx * 0.1);
                subGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
                
                subOsc.start(now + idx * 0.1);
                subOsc.stop(now + idx * 0.1 + 0.25);
            });
            break;
    }
}

// --- Sound Mute/Unmute Controls ---
function loadSoundPreference() {
    const savedSound = localStorage.getItem('isSoundMuted');
    if (savedSound !== null) {
        isSoundMuted = savedSound === 'true';
    }
    updateSoundBtnUI();
}

function updateSoundBtnUI() {
    if (isSoundMuted) {
        soundIcon.textContent = '🔇';
        soundToggleBtn.title = 'เปิดเสียง';
        soundToggleBtn.style.opacity = '0.6';
    } else {
        soundIcon.textContent = '🔊';
        soundToggleBtn.title = 'ปิดเสียง';
        soundToggleBtn.style.opacity = '1';
    }
}

// --- Local Storage & High Scores per Theme ---
function getBestScoreKey() {
    return `best_${currentTheme}`;
}

function getBestScore() {
    const data = localStorage.getItem(getBestScoreKey());
    return data ? JSON.parse(data) : null;
}

function updateBestScoreUI() {
    const best = getBestScore();
    if (best) {
        bestScoreDisplay.textContent = `${best.moves} ครั้ง (${formatTime(best.time)})`;
    } else {
        bestScoreDisplay.textContent = '--:--';
    }
}

function saveBestScore(newMoves, newTime) {
    const best = getBestScore();
    let isNewRecord = false;
    
    const recordData = { moves: newMoves, time: newTime };
    
    if (!best) {
        localStorage.setItem(getBestScoreKey(), JSON.stringify(recordData));
        isNewRecord = true;
    } else {
        // Record if fewer moves, or equal moves but faster time
        if (newMoves < best.moves || (newMoves === best.moves && newTime < best.time)) {
            localStorage.setItem(getBestScoreKey(), JSON.stringify(recordData));
            isNewRecord = true;
        }
    }
    return isNewRecord;
}

// --- Timer Functions ---
function startTimer() {
    timerInterval = setInterval(() => {
        timeElapsed++;
        timerDisplay.textContent = formatTime(timeElapsed);
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- Progress Bar Updater ---
function updateProgressBar() {
    const percent = Math.round((matchedPairs / 12) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
}

// --- Card Sparkle Particles Effect ---
function createSparkleParticles(cardElement) {
    const rect = cardElement.getBoundingClientRect();
    const boardRect = boardWrapper.getBoundingClientRect();
    
    // Coordinates relative to board container
    const centerX = rect.left - boardRect.left + rect.width / 2;
    const centerY = rect.top - boardRect.top + rect.height / 2;
    
    const colors = ['#f43f5e', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
    const particleCount = 12;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('sparkle-particle');
        
        // Random particle angle & distance
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 50 + 30; // Exploding distance
        const targetX = Math.cos(angle) * distance;
        const targetY = Math.sin(angle) * distance;
        
        const size = Math.random() * 6 + 4;
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.backgroundColor = randomColor;
        
        // Pass travel endpoints to CSS via Custom Variables
        particle.style.setProperty('--tx', `${targetX}px`);
        particle.style.setProperty('--ty', `${targetY}px`);
        
        boardWrapper.appendChild(particle);
        
        // Cleanup particle
        setTimeout(() => particle.remove(), 600);
    }
}

// --- Combo Mechanics logic ---
function handleCombo() {
    const now = Date.now();
    const delay = now - lastMatchTime;
    
    if (lastMatchTime > 0 && delay < 3500) {
        // Successful match within 3.5s increments combo
        comboCount++;
        showComboIndicator();
    } else {
        // Reset combo if too slow
        comboCount = 1;
        hideComboIndicator();
    }
    lastMatchTime = now;
}

function showComboIndicator() {
    if (comboCount < 2) return;
    
    comboIndicator.textContent = `COMBO x${comboCount} 🔥`;
    comboIndicator.classList.add('active');
    
    // Auto reset popup after 1.8s
    if (comboTimeout) clearTimeout(comboTimeout);
    comboTimeout = setTimeout(hideComboIndicator, 1800);
}

function hideComboIndicator() {
    comboIndicator.classList.remove('active');
}

// --- Memory Peek Phase & Game Initialization ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function initGame() {
    // 1. Reset Game states
    stopTimer();
    flippedCards = [];
    moves = 0;
    matchedPairs = 0;
    timeElapsed = 0;
    gameStarted = false;
    isLocked = true; // Lock cards during memorize phase
    comboCount = 0;
    lastMatchTime = 0;
    
    // 2. Reset UI
    timerDisplay.textContent = '00:00';
    movesDisplay.textContent = '0 ครั้ง';
    winModal.classList.remove('active');
    newRecordBadge.style.display = 'none';
    hideComboIndicator();
    updateProgressBar();
    updateBestScoreUI();
    
    // 3. Select Theme Cards
    const themeIcons = THEMES[currentTheme];
    deck = [...themeIcons, ...themeIcons];
    shuffle(deck);
    
    // 4. Render Board
    gameBoard.innerHTML = '';
    deck.forEach((icon, index) => {
        const card = createCardElement(icon, index);
        gameBoard.appendChild(card);
    });
    
    // 5. Trigger Memory Peek Phase
    startPeekPhase();
}

function createCardElement(icon, index) {
    const card = document.createElement('div');
    card.classList.add('card');
    card.dataset.value = icon;
    card.dataset.index = index;
    
    card.innerHTML = `
        <div class="card-inner">
            <div class="card-back"></div>
            <div class="card-front">${icon}</div>
        </div>
    `;
    
    card.addEventListener('click', () => handleCardClick(card));
    return card;
}

function startPeekPhase() {
    // Reveal all cards
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => card.classList.add('flipped'));
    
    // Activate Countdown Overlay
    countdownOverlay.classList.add('active');
    countdownNumber.textContent = '3';
    
    // Reset visual loading progress bar in overlay
    countdownBarFill.style.transition = 'none';
    countdownBarFill.style.width = '100%';
    
    // Trigger transition next frame
    setTimeout(() => {
        countdownBarFill.style.transition = 'width 3s linear';
        countdownBarFill.style.width = '0%';
    }, 50);
    
    let countdownVal = 3;
    playSound('countdown');
    
    const interval = setInterval(() => {
        countdownVal--;
        if (countdownVal > 0) {
            countdownNumber.textContent = countdownVal;
            playSound('countdown');
        } else {
            clearInterval(interval);
            
            // Flip cards back face down
            cards.forEach(card => card.classList.remove('flipped'));
            countdownOverlay.classList.remove('active');
            playSound('countdown-start');
            
            // Start the game!
            isLocked = false;
        }
    }, 1000);
}

// --- Card Clicking Handler ---
function handleCardClick(card) {
    if (isLocked) return;
    
    // Initialize Web Audio on first touch (mandatory browser rule)
    initAudio();
    
    if (card.classList.contains('flipped') || card.classList.contains('matched')) {
        return;
    }
    
    // Start game timer on very first flip
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }
    
    card.classList.add('flipped');
    playSound('flip');
    flippedCards.push(card);
    
    if (flippedCards.length === 2) {
        moves++;
        movesDisplay.textContent = `${moves} ครั้ง`;
        checkForMatch();
    }
}

// --- Match Checking ---
function checkForMatch() {
    isLocked = true;
    
    const [card1, card2] = flippedCards;
    const isMatch = card1.dataset.value === card2.dataset.value;
    
    if (isMatch) {
        // Match Success
        setTimeout(() => {
            card1.classList.add('matched');
            card2.classList.add('matched');
            
            // Particle Explosion
            createSparkleParticles(card1);
            createSparkleParticles(card2);
            
            // Handle Combo multiplier sound pitch
            handleCombo();
            playSound('match');
            
            matchedPairs++;
            updateProgressBar();
            flippedCards = [];
            isLocked = false;
            
            if (matchedPairs === 12) {
                setTimeout(handleVictory, 600);
            }
        }, 300);
    } else {
        // Mismatch - Flip back face down
        setTimeout(() => {
            playSound('mismatch');
            card1.classList.remove('flipped');
            card2.classList.remove('flipped');
            flippedCards = [];
            comboCount = 0; // Reset combo count
            hideComboIndicator();
            isLocked = false;
        }, 1000);
    }
}

// --- Victory Screen & Star Evaluation ---
function calculateStars(totalMoves) {
    // 3 Stars: <= 16 moves (Outstanding memory / lucky)
    // 2 Stars: 17 - 24 moves (Good)
    // 1 Star: >= 25 moves
    if (totalMoves <= 16) {
        return { count: 3, label: 'ยอดเยี่ยมที่สุด! ความจำระดับอัจฉริยะ 🧠⭐' };
    } else if (totalMoves <= 24) {
        return { count: 2, label: 'เก่งมาก! ความจำดีเยี่ยม 👍⭐' };
    } else {
        return { count: 1, label: 'ผ่านแล้ว! พยายามต่อสู้ต่อไป 💪⭐' };
    }
}

function handleVictory() {
    stopTimer();
    playSound('victory');
    
    const formattedTime = formatTime(timeElapsed);
    finalTimeDisplay.textContent = formattedTime;
    finalMovesDisplay.textContent = `${moves} ครั้ง`;
    
    // Save best scores
    const isNewRecord = saveBestScore(moves, timeElapsed);
    if (isNewRecord) {
        newRecordBadge.style.display = 'inline-block';
    }
    
    // Render Star Rating
    const evaluation = calculateStars(moves);
    const starSpans = modalStars.querySelectorAll('.star-icon');
    starSpans.forEach((span, idx) => {
        if (idx < evaluation.count) {
            span.classList.add('filled');
            span.style.animationDelay = `${idx * 0.15}s`;
        } else {
            span.classList.remove('filled');
        }
    });
    starRatingLabel.textContent = evaluation.label;
    
    updateBestScoreUI();
    
    // Open modal & throw confetti
    winModal.classList.add('active');
    triggerConfetti();
}

// --- Celebratory Confetti Generator ---
function triggerConfetti() {
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f97316'];
    const confettiCount = 80;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const leftPos = Math.random() * 100;
        const delay = Math.random() * 2.5;
        const duration = Math.random() * 2 + 2;
        const size = Math.random() * 8 + 5;
        
        confetti.style.left = `${leftPos}vw`;
        confetti.style.top = `-20px`;
        confetti.style.backgroundColor = randomColor;
        confetti.style.width = `${size}px`;
        confetti.style.height = `${size}px`;
        confetti.style.opacity = Math.random() * 0.7 + 0.3;
        confetti.style.animationName = 'fall';
        confetti.style.animationDuration = `${duration}s`;
        confetti.style.animationDelay = `${delay}s`;
        confetti.style.animationTimingFunction = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        }
        
        document.body.appendChild(confetti);
        
        // Clean memory
        setTimeout(() => confetti.remove(), (duration + delay) * 1000);
    }
}

// --- Action Event Listeners ---
themeSelect.addEventListener('change', (e) => {
    currentTheme = e.target.value;
    initGame();
});

soundToggleBtn.addEventListener('click', () => {
    isSoundMuted = !isSoundMuted;
    localStorage.setItem('isSoundMuted', isSoundMuted);
    updateSoundBtnUI();
    
    // Trigger tiny audio activation if unmuting
    if (!isSoundMuted) {
        initAudio();
        playSound('countdown-start');
    }
});

restartBtn.addEventListener('click', () => {
    // Pulse animation button
    restartBtn.style.transform = 'scale(0.95)';
    setTimeout(() => restartBtn.style.transform = 'none', 100);
    initGame();
});

playAgainBtn.addEventListener('click', () => {
    initGame();
});

// --- Page Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    loadSoundPreference();
    initGame();
});
