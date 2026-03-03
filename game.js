// =============================================================================
// CUP SHUFFLE GAME - Find Morph!
// A cup shuffle minigame with placeholder graphics ready for asset replacement
// =============================================================================

// -----------------------------------------------------------------------------
// CONFIGURATION & CONSTANTS
// -----------------------------------------------------------------------------
const CONFIG = {
    // Canvas dimensions
    WIDTH: 800,
    HEIGHT: 600,

    // Cup layout
    CUP_WIDTH: 110,
    CUP_HEIGHT: 145,
    CUP_SPACING: 160,
    CUP_Y: 280,

    // Morph dimensions
    MORPH_WIDTH: 60,
    MORPH_HEIGHT: 50,

    // UI positions
    TITLE_Y: 70,
    SUBTITLE_Y: 170,
    HUD_Y: 540,

    // Colors
    COLORS: {
        background: '#1a1a2e',
        backgroundGradientTop: '#0f0f1a',
        backgroundGradientBottom: '#2a2a4e',
        platform: '#e8e8f0',
        platformShadow: '#c0c0d0',
        cup: '#d4c896',
        cupHighlight: '#f0e8c0',
        cupShadow: '#a09060',
        cupRim: '#e8dca8',
        morph: '#ff6b9d',
        morphHighlight: '#ff9bc0',
        morphEye: '#ffffff',
        morphPupil: '#222222',
        title: '#4ac3e0',
        subtitle: '#4ac3e0',
        hudText: '#ffffff',
        hudLabel: '#8888aa',
        debugText: '#00ff00',
        debugSlot: 'rgba(255, 255, 0, 0.3)',
        gold: '#ffd700',
        leaderboardBg: 'rgba(0, 0, 0, 0.9)'
    },

    // Timing (ms)
    REVEAL_START_DURATION: 1500,
    REVEAL_RESULT_DURATION: 2000,
    ROUND_END_DURATION: 1500,
    CUP_LIFT_DURATION: 400,

    // Game settings
    INITIAL_CHANCES: 3,
    BASE_SCORE: 50,
    STREAK_BONUS: 25
};

// FIXED slot positions - these NEVER change
const SLOTS = [
    { x: CONFIG.WIDTH / 2 - CONFIG.CUP_SPACING, y: CONFIG.CUP_Y },
    { x: CONFIG.WIDTH / 2, y: CONFIG.CUP_Y },
    { x: CONFIG.WIDTH / 2 + CONFIG.CUP_SPACING, y: CONFIG.CUP_Y }
];

// -----------------------------------------------------------------------------
// GAME STATES
// -----------------------------------------------------------------------------
const GameState = {
    INTRO: 'INTRO',
    REVEAL_START: 'REVEAL_START',
    SHUFFLING: 'SHUFFLING',
    GUESS: 'GUESS',
    REVEAL_RESULT: 'REVEAL_RESULT',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER',
    NAME_ENTRY: 'NAME_ENTRY'
};

// -----------------------------------------------------------------------------
// LEADERBOARD
// -----------------------------------------------------------------------------
const LEADERBOARD_KEY = 'morphCupShuffleLeaderboard';
const MAX_LEADERBOARD_ENTRIES = 10;
const MAX_NAME_LENGTH = 10;

class Leaderboard {
    constructor() {
        this.entries = this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(LEADERBOARD_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn('Failed to load leaderboard:', e);
        }
        return [];
    }

    save() {
        try {
            localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.entries));
        } catch (e) {
            console.warn('Failed to save leaderboard:', e);
        }
    }

    // Check if score qualifies for leaderboard
    qualifies(score) {
        if (this.entries.length < MAX_LEADERBOARD_ENTRIES) {
            return true;
        }
        return score > this.entries[this.entries.length - 1].score;
    }

    // Add entry and return its rank (1-indexed)
    addEntry(name, score, level) {
        const entry = {
            name: name.toUpperCase().substring(0, MAX_NAME_LENGTH),
            score: score,
            level: level,
            date: new Date().toISOString()
        };

        this.entries.push(entry);
        this.entries.sort((a, b) => b.score - a.score);
        this.entries = this.entries.slice(0, MAX_LEADERBOARD_ENTRIES);
        this.save();

        // Return rank
        return this.entries.findIndex(e => e === entry) + 1;
    }

    getEntries() {
        return this.entries;
    }

    clear() {
        this.entries = [];
        this.save();
    }
}

// -----------------------------------------------------------------------------
// SEEDED RANDOM NUMBER GENERATOR (LCG)
// -----------------------------------------------------------------------------
class SeededRNG {
    constructor(seed = Date.now()) {
        this.seed = seed;
        this.current = seed;
    }

    next() {
        this.current = (this.current * 1664525 + 1013904223) % 4294967296;
        return this.current / 4294967296;
    }

    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    setSeed(seed) {
        this.seed = seed;
        this.current = seed;
    }
}

// -----------------------------------------------------------------------------
// EASING FUNCTIONS
// -----------------------------------------------------------------------------
const Easing = {
    easeInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
};

// -----------------------------------------------------------------------------
// SPRITE SHEET ANIMATOR
// -----------------------------------------------------------------------------
// Config for Morph sprite sheet - adjust these to match your sprite sheet
const MORPH_SPRITE_CONFIG = {
    frameWidth: 256,     // Width of each frame in pixels
    frameHeight: 256,    // Height of each frame in pixels
    totalFrames: 18,     // Total number of frames (18 frames: 7+7+4)
    columns: 7,          // Number of columns in the sprite sheet
    fps: 14,             // Frames per second (0.07s delay = ~14fps)
    scale: 0.35          // Scale down to fit under cup (~90px wide)
};

class SpriteSheetAnimator {
    /**
     * @param {HTMLImageElement} image - The sprite sheet image
     * @param {number} frameWidth - Width of each frame
     * @param {number} frameHeight - Height of each frame
     * @param {number} totalFrames - Total number of frames
     * @param {number} columns - Number of columns in the sheet
     * @param {number} fps - Frames per second
     */
    constructor(image, frameWidth, frameHeight, totalFrames, columns, fps) {
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.totalFrames = totalFrames;
        this.columns = columns;
        this.fps = fps;
        this.elapsed = 0;
        this.paused = false;
    }

    /**
     * Update animation timing
     * @param {number} dtSeconds - Delta time in seconds from game loop
     */
    update(dtSeconds) {
        if (this.paused) return;
        this.elapsed += dtSeconds;
    }

    /**
     * Reset animation to first frame
     */
    reset() {
        this.elapsed = 0;
    }

    /**
     * Pause/unpause animation
     * @param {boolean} paused
     */
    setPaused(paused) {
        this.paused = paused;
    }

    /**
     * Get current frame index
     * @returns {number}
     */
    getFrameIndex() {
        return Math.floor(this.elapsed * this.fps) % this.totalFrames;
    }

    /**
     * Draw the current frame
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} scale - Scale multiplier (default 1)
     * @param {string} anchor - Anchor point: "center", "top-left", "bottom-center" (default "center")
     */
    draw(ctx, x, y, scale = 1, anchor = 'center') {
        if (!this.image || !this.image.complete) return;

        const frameIndex = this.getFrameIndex();
        const sx = (frameIndex % this.columns) * this.frameWidth;
        const sy = Math.floor(frameIndex / this.columns) * this.frameHeight;

        const destWidth = this.frameWidth * scale;
        const destHeight = this.frameHeight * scale;

        // Calculate draw position based on anchor
        let dx, dy;
        switch (anchor) {
            case 'top-left':
                dx = x;
                dy = y;
                break;
            case 'bottom-center':
                dx = x - destWidth / 2;
                dy = y - destHeight;
                break;
            case 'center':
            default:
                dx = x - destWidth / 2;
                dy = y - destHeight / 2;
                break;
        }

        ctx.drawImage(
            this.image,
            sx, sy, this.frameWidth, this.frameHeight,  // Source rect
            dx, dy, destWidth, destHeight                // Dest rect
        );
    }
}

// -----------------------------------------------------------------------------
// CUP CLASS
// -----------------------------------------------------------------------------
class Cup {
    constructor(id) {
        this.id = id;
        this.width = CONFIG.CUP_WIDTH;
        this.height = CONFIG.CUP_HEIGHT;

        // Render position (visual) - tweened during animation
        this.renderX = SLOTS[id].x;
        this.renderY = SLOTS[id].y;

        // Animation state
        this.animating = false;
        this.fromX = 0;
        this.fromY = 0;
        this.toX = 0;
        this.toY = 0;
        this.animT = 0;
        this.animDuration = 0;
        this.arcHeight = 0;

        // Lift animation
        this.liftAmount = 0;
        this.liftAnimating = false;
        this.liftFrom = 0;
        this.liftTo = 0;
        this.liftT = 0;
        this.liftDuration = 0;
        this.liftCallback = null;

        // Z-order for drawing (higher = on top)
        this.z = 0;
    }

    // Check if point is inside cup's RENDER bounds
    containsPoint(px, py) {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        return px >= this.renderX - halfW && px <= this.renderX + halfW &&
               py >= this.renderY - halfH && py <= this.renderY + halfH;
    }

    // Start lift animation
    startLift(targetLift, duration, callback) {
        this.liftAnimating = true;
        this.liftFrom = this.liftAmount;
        this.liftTo = targetLift;
        this.liftT = 0;
        this.liftDuration = duration;
        this.liftCallback = callback;
    }

    // Update animations
    update(deltaTime) {
        // Update swap animation
        if (this.animating) {
            this.animT += deltaTime;
            const progress = Math.min(this.animT / this.animDuration, 1);
            const eased = Easing.easeInOut(progress);

            // Interpolate X
            this.renderX = this.fromX + (this.toX - this.fromX) * eased;

            // Arc for Y
            const arcProgress = Math.sin(progress * Math.PI);
            const baseY = this.fromY + (this.toY - this.fromY) * eased;
            this.renderY = baseY - this.arcHeight * arcProgress;

            if (progress >= 1) {
                this.animating = false;
                // SNAP to exact target
                this.renderX = this.toX;
                this.renderY = this.toY;
            }
        }

        // Update lift animation
        if (this.liftAnimating) {
            this.liftT += deltaTime;
            const progress = Math.min(this.liftT / this.liftDuration, 1);
            const eased = Easing.easeInOut(progress);

            this.liftAmount = this.liftFrom + (this.liftTo - this.liftFrom) * eased;

            if (progress >= 1) {
                this.liftAnimating = false;
                this.liftAmount = this.liftTo;
                if (this.liftCallback) {
                    this.liftCallback();
                    this.liftCallback = null;
                }
            }
        }
    }

    // Snap render position to a slot
    snapToSlot(slotIndex) {
        this.renderX = SLOTS[slotIndex].x;
        this.renderY = SLOTS[slotIndex].y;
        this.animating = false;
    }
}

// -----------------------------------------------------------------------------
// ASSET SYSTEM
// -----------------------------------------------------------------------------
class Assets {
    constructor() {
        this.images = {};
        this.loaded = false;
    }

    /**
     * Load an image and return a promise
     * @param {string} name - Key to store the image under
     * @param {string} src - Image source path
     * @returns {Promise<HTMLImageElement>}
     */
    loadImage(name, src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.images[name] = img;
                console.log(`Loaded asset: ${name}`);
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`Failed to load asset: ${name} from ${src}`);
                resolve(null); // Resolve with null so other assets can still load
            };
            img.src = src;
        });
    }

    /**
     * Load all game assets
     * @returns {Promise<void>}
     */
    async loadAll() {
        await Promise.all([
            this.loadImage('morphSheet', 'assets/morph-sprite-converter.png'),
            // Add other assets here as needed:
            // this.loadImage('cup', 'assets/cup.png'),
            // this.loadImage('platform', 'assets/platform.png'),
        ]);
        this.loaded = true;
    }

    /**
     * Check if animated webp/gif exists for DOM fallback
     * @returns {boolean}
     */
    hasMorphAnimation() {
        return document.getElementById('morphGif') !== null;
    }

    draw(ctx, name, x, y, w, h, options = {}) {
        if (this.images[name]) {
            ctx.drawImage(this.images[name], x - w/2, y - h/2, w, h);
        } else {
            this.drawPlaceholder(ctx, name, x, y, w, h, options);
        }
    }

    drawPlaceholder(ctx, name, x, y, w, h, options = {}) {
        switch (name) {
            case 'cup':
                this.drawCup(ctx, x, y, w, h, options);
                break;
            case 'morph':
                this.drawMorph(ctx, x, y, w, h, options);
                break;
            case 'platform':
                this.drawPlatform(ctx, x, y, w, h);
                break;
        }
    }

    drawCupShadow(ctx, x, y, w, h, liftAmount) {
        if (liftAmount > 0) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, 0.3 - (liftAmount / 200));
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(x, y + h/2, w/2 + liftAmount/10, 15 + liftAmount/20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    drawCup(ctx, x, y, w, h, options = {}) {
        const highlight = options.highlight || false;
        const liftAmount = options.liftAmount || 0;
        const drawY = y - liftAmount;

        const topWidth = w * 0.75;
        const bottomWidth = w * 0.95;

        ctx.save();

        const gradient = ctx.createLinearGradient(x - w/2, drawY, x + w/2, drawY);
        gradient.addColorStop(0, CONFIG.COLORS.cupShadow);
        gradient.addColorStop(0.3, CONFIG.COLORS.cup);
        gradient.addColorStop(0.5, CONFIG.COLORS.cupHighlight);
        gradient.addColorStop(0.7, CONFIG.COLORS.cup);
        gradient.addColorStop(1, CONFIG.COLORS.cupShadow);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x - topWidth/2, drawY - h/2);
        ctx.lineTo(x + topWidth/2, drawY - h/2);
        ctx.lineTo(x + bottomWidth/2, drawY + h/2);
        ctx.lineTo(x - bottomWidth/2, drawY + h/2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.cupRim;
        ctx.beginPath();
        ctx.ellipse(x, drawY - h/2, topWidth/2, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.cupShadow;
        ctx.beginPath();
        ctx.ellipse(x, drawY - h/2, topWidth/2 - 8, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.cupRim;
        ctx.beginPath();
        ctx.ellipse(x, drawY + h/2, bottomWidth/2, 10, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        if (highlight) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x - topWidth/2, drawY - h/2);
            ctx.lineTo(x + topWidth/2, drawY - h/2);
            ctx.lineTo(x + bottomWidth/2, drawY + h/2);
            ctx.lineTo(x - bottomWidth/2, drawY + h/2);
            ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();
    }

    drawMorph(ctx, x, y, w, h) {
        ctx.save();

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, w/2);
        gradient.addColorStop(0, CONFIG.COLORS.morphHighlight);
        gradient.addColorStop(0.7, CONFIG.COLORS.morph);
        gradient.addColorStop(1, '#cc4477');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(x, y - h/2);
        ctx.bezierCurveTo(x + w/2, y - h/2, x + w/2, y + h/3, x + w/3, y + h/2);
        ctx.bezierCurveTo(x + w/6, y + h/2 + 5, x - w/6, y + h/2 + 5, x - w/3, y + h/2);
        ctx.bezierCurveTo(x - w/2, y + h/3, x - w/2, y - h/2, x, y - h/2);
        ctx.fill();

        const eyeY = y - h/8;
        const eyeSpacing = w/4;
        const eyeSize = w/6;

        ctx.fillStyle = CONFIG.COLORS.morphEye;
        ctx.beginPath();
        ctx.ellipse(x - eyeSpacing, eyeY, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + eyeSpacing, eyeY, eyeSize, eyeSize * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = CONFIG.COLORS.morphPupil;
        ctx.beginPath();
        ctx.arc(x - eyeSpacing + 2, eyeY + 2, eyeSize/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeSpacing + 2, eyeY + 2, eyeSize/2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x - eyeSpacing - 2, eyeY - 3, eyeSize/4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + eyeSpacing - 2, eyeY - 3, eyeSize/4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#cc4477';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + h/6, w/5, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        ctx.restore();
    }

    drawPlatform(ctx, x, y, w, h) {
        ctx.save();

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, w/2);
        gradient.addColorStop(0, CONFIG.COLORS.platform);
        gradient.addColorStop(0.7, CONFIG.COLORS.platformShadow);
        gradient.addColorStop(1, '#a0a0b0');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(x, y, w/2, h/2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y - h/4, w/3, h/6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// -----------------------------------------------------------------------------
// MAIN GAME CLASS
// -----------------------------------------------------------------------------
class CupShuffleGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assets = new Assets();
        this.rng = new SeededRNG();

        // Game state
        this.state = GameState.INTRO;
        this.stateTimer = null;

        // CUPS - stable array, never reordered
        this.cups = [
            new Cup(0),
            new Cup(1),
            new Cup(2)
        ];

        // SLOT MAPPINGS - the source of truth for positions
        // cupToSlot[cupId] = slotIndex (which slot is cup in?)
        // slotToCup[slotIndex] = cupId (which cup is in this slot?)
        this.cupToSlot = [0, 1, 2]; // cup 0 in slot 0, cup 1 in slot 1, cup 2 in slot 2
        this.slotToCup = [0, 1, 2]; // slot 0 has cup 0, slot 1 has cup 1, slot 2 has cup 2

        // Morph tracking
        this.morphCupId = 1; // Which cup ID morph is under
        this.morphVisible = false;

        // Game stats
        this.score = 0;
        this.level = 1;
        this.chances = CONFIG.INITIAL_CHANCES;
        this.round = 1;
        this.streak = 0;

        // Shuffle state
        this.shufflePlan = [];
        this.currentSwapIndex = 0;
        this.isSwapping = false; // Lock to prevent concurrent swaps

        // Interaction
        this.hoveredCupId = -1;
        this.selectedCupId = -1;
        this.guessCorrect = false;

        // Debug
        this.debugMode = false;

        // Leaderboard
        this.leaderboard = new Leaderboard();
        this.showLeaderboard = false;
        this.playerName = '';
        this.nameEntryCursor = true; // Blinking cursor
        this.cursorBlinkTime = 0;

        // Morph sprite animator (initialized after assets load)
        this.morphAnimator = null;

        // DOM element for animated webp/gif
        this.morphDomElement = null;
        this.useDomMorph = false;

        // Subtitle text
        this.subtitle = 'CHOOSE YOUR CUP TO START!';

        // Timing
        this.lastTime = performance.now();

        // Bind methods
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Set up event listeners
        this.canvas.addEventListener('click', this.handleClick);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('keydown', this.handleKeyDown);

        // Initialize cup positions
        this.resetMappings();

        // Start game loop
        this.gameLoop();
    }

    // -------------------------------------------------------------------------
    // DOM FALLBACK FOR ANIMATED GIF
    // -------------------------------------------------------------------------
    setupMorphDomFallback() {
        // Check if morph GIF element exists in DOM
        let morphEl = document.getElementById('morphSprite');
        if (!morphEl) {
            // Create the element if it doesn't exist
            morphEl = document.createElement('img');
            morphEl.id = 'morphSprite';
            morphEl.src = 'assets/morph.gif';
            morphEl.style.position = 'absolute';
            morphEl.style.pointerEvents = 'none';
            morphEl.style.visibility = 'hidden';
            morphEl.style.width = CONFIG.MORPH_WIDTH + 'px';
            morphEl.style.height = CONFIG.MORPH_HEIGHT + 'px';

            // Position relative to canvas
            const canvasRect = this.canvas.getBoundingClientRect();
            morphEl.style.left = canvasRect.left + 'px';
            morphEl.style.top = canvasRect.top + 'px';

            document.body.appendChild(morphEl);
        }
        this.morphDomElement = morphEl;
        console.log('Morph DOM fallback initialized');
    }

    // Update DOM element position for animated webp/gif
    updateMorphDomPosition() {
        if (!this.morphDomElement) return;

        if (this.morphVisible) {
            const morphCup = this.cups[this.morphCupId];

            // Size for the morph (adjust as needed)
            const morphWidth = 100;
            const morphHeight = 80;

            // Position relative to the canvas container
            const morphX = morphCup.renderX - morphWidth / 2;
            const morphY = morphCup.renderY + CONFIG.CUP_HEIGHT / 2 - morphHeight + 10;

            this.morphDomElement.style.left = morphX + 'px';
            this.morphDomElement.style.top = morphY + 'px';
            this.morphDomElement.style.width = morphWidth + 'px';
            this.morphDomElement.style.height = morphHeight + 'px';
            this.morphDomElement.style.visibility = 'visible';
        } else {
            this.morphDomElement.style.visibility = 'hidden';
        }
    }

    // -------------------------------------------------------------------------
    // MAPPING MANAGEMENT
    // -------------------------------------------------------------------------
    resetMappings() {
        // Reset to initial state: cup i in slot i
        this.cupToSlot = [0, 1, 2];
        this.slotToCup = [0, 1, 2];

        // Snap all cups to their slots
        for (let i = 0; i < 3; i++) {
            this.cups[i].snapToSlot(i);
            this.cups[i].liftAmount = 0;
            this.cups[i].z = 0;
        }
    }

    validateMappings() {
        // Check that no two cups share the same slot
        const slotsUsed = new Set();
        for (let cupId = 0; cupId < 3; cupId++) {
            const slot = this.cupToSlot[cupId];
            if (slotsUsed.has(slot)) {
                console.error(`ERROR: Multiple cups in slot ${slot}!`);
                console.error('cupToSlot:', this.cupToSlot);
                console.error('slotToCup:', this.slotToCup);
                throw new Error(`Slot collision detected: slot ${slot}`);
            }
            slotsUsed.add(slot);
        }

        // Verify bidirectional consistency
        for (let slot = 0; slot < 3; slot++) {
            const cupId = this.slotToCup[slot];
            if (this.cupToSlot[cupId] !== slot) {
                console.error(`Mapping inconsistency: slotToCup[${slot}]=${cupId} but cupToSlot[${cupId}]=${this.cupToSlot[cupId]}`);
                throw new Error('Mapping inconsistency detected');
            }
        }
    }

    // -------------------------------------------------------------------------
    // SWAP LOGIC (ATOMIC)
    // -------------------------------------------------------------------------
    startSwap(slotA, slotB, duration) {
        return new Promise((resolve) => {
            if (this.isSwapping) {
                console.warn('Swap already in progress, waiting...');
                resolve();
                return;
            }

            if (slotA === slotB) {
                resolve();
                return;
            }

            this.isSwapping = true;

            // Get cup IDs in each slot
            const cupA = this.slotToCup[slotA];
            const cupB = this.slotToCup[slotB];

            // UPDATE MAPPINGS IMMEDIATELY (before animation)
            this.slotToCup[slotA] = cupB;
            this.slotToCup[slotB] = cupA;
            this.cupToSlot[cupA] = slotB;
            this.cupToSlot[cupB] = slotA;

            // Validate after update
            this.validateMappings();

            // Get cup objects
            const cup1 = this.cups[cupA];
            const cup2 = this.cups[cupB];

            // Set up animations - animate FROM current render pos TO new slot pos
            cup1.fromX = cup1.renderX;
            cup1.fromY = cup1.renderY;
            cup1.toX = SLOTS[slotB].x;
            cup1.toY = SLOTS[slotB].y;
            cup1.animT = 0;
            cup1.animDuration = duration;
            cup1.arcHeight = 60;
            cup1.animating = true;
            cup1.z = 1; // Draw on top

            cup2.fromX = cup2.renderX;
            cup2.fromY = cup2.renderY;
            cup2.toX = SLOTS[slotA].x;
            cup2.toY = SLOTS[slotA].y;
            cup2.animT = 0;
            cup2.animDuration = duration;
            cup2.arcHeight = -40; // Lower arc
            cup2.animating = true;
            cup2.z = 0;

            // Wait for animation to complete
            const checkComplete = () => {
                if (!cup1.animating && !cup2.animating) {
                    // SNAP to exact positions
                    cup1.snapToSlot(slotB);
                    cup2.snapToSlot(slotA);
                    cup1.z = 0;
                    cup2.z = 0;
                    this.isSwapping = false;
                    resolve();
                } else {
                    requestAnimationFrame(checkComplete);
                }
            };
            requestAnimationFrame(checkComplete);
        });
    }

    // -------------------------------------------------------------------------
    // STATE MANAGEMENT
    // -------------------------------------------------------------------------
    setState(newState) {
        this.state = newState;

        if (this.stateTimer) {
            clearTimeout(this.stateTimer);
            this.stateTimer = null;
        }

        switch (newState) {
            case GameState.INTRO:
                this.subtitle = 'CHOOSE YOUR CUP TO START!';
                this.resetMappings();
                break;

            case GameState.REVEAL_START:
                this.subtitle = 'WATCH CLOSELY!';
                this.morphVisible = true;

                // Reset animator so animation starts fresh
                if (this.morphAnimator) {
                    this.morphAnimator.reset();
                }

                const morphCup = this.cups[this.morphCupId];
                morphCup.startLift(80, CONFIG.CUP_LIFT_DURATION, () => {
                    this.stateTimer = setTimeout(() => {
                        morphCup.startLift(0, CONFIG.CUP_LIFT_DURATION, () => {
                            this.morphVisible = false;
                            this.setState(GameState.SHUFFLING);
                        });
                    }, CONFIG.REVEAL_START_DURATION - CONFIG.CUP_LIFT_DURATION * 2);
                });
                break;

            case GameState.SHUFFLING:
                this.subtitle = 'SHUFFLING...';
                this.generateShufflePlan();
                this.executeShufflePlan();
                break;

            case GameState.GUESS:
                this.subtitle = 'PICK A CUP!';
                this.selectedCupId = -1;
                // Ensure all cups are not animating
                this.cups.forEach(cup => {
                    cup.animating = false;
                    cup.z = 0;
                });
                break;

            case GameState.REVEAL_RESULT:
                this.morphVisible = true;

                // Reset animator so animation starts fresh
                if (this.morphAnimator) {
                    this.morphAnimator.reset();
                }

                const chosenCup = this.cups[this.selectedCupId];

                if (this.guessCorrect) {
                    this.subtitle = 'CORRECT!';
                    chosenCup.startLift(80, CONFIG.CUP_LIFT_DURATION, () => {
                        this.stateTimer = setTimeout(() => {
                            this.setState(GameState.ROUND_END);
                        }, CONFIG.REVEAL_RESULT_DURATION);
                    });
                } else {
                    this.subtitle = 'WRONG!';
                    chosenCup.startLift(80, CONFIG.CUP_LIFT_DURATION, () => {
                        this.stateTimer = setTimeout(() => {
                            const correctCup = this.cups[this.morphCupId];
                            correctCup.startLift(80, CONFIG.CUP_LIFT_DURATION, () => {
                                this.stateTimer = setTimeout(() => {
                                    this.setState(GameState.ROUND_END);
                                }, CONFIG.REVEAL_RESULT_DURATION);
                            });
                        }, 500);
                    });
                }
                break;

            case GameState.ROUND_END:
                this.morphVisible = false;
                this.cups.forEach(cup => {
                    if (cup.liftAmount > 0) {
                        cup.startLift(0, CONFIG.CUP_LIFT_DURATION, null);
                    }
                });

                if (this.guessCorrect) {
                    const points = CONFIG.BASE_SCORE + (this.streak * CONFIG.STREAK_BONUS);
                    this.score += points;
                    this.streak++;

                    if (this.streak > 0 && this.streak % 3 === 0) {
                        this.level = Math.min(this.level + 1, 10);
                    }

                    this.round++;
                    this.subtitle = `+${points} POINTS!`;
                } else {
                    this.chances--;
                    this.streak = 0;

                    if (this.chances <= 0) {
                        this.stateTimer = setTimeout(() => {
                            this.setState(GameState.GAME_OVER);
                        }, CONFIG.ROUND_END_DURATION);
                        return;
                    }

                    this.subtitle = `${this.chances} CHANCE${this.chances > 1 ? 'S' : ''} LEFT`;
                }

                this.stateTimer = setTimeout(() => {
                    this.startNewRound();
                }, CONFIG.ROUND_END_DURATION);
                break;

            case GameState.GAME_OVER:
                this.subtitle = 'GAME OVER';
                // Check if score qualifies for leaderboard
                if (this.score > 0 && this.leaderboard.qualifies(this.score)) {
                    this.stateTimer = setTimeout(() => {
                        this.setState(GameState.NAME_ENTRY);
                    }, 1500);
                } else {
                    this.subtitle = 'GAME OVER - PRESS R TO RESTART';
                }
                break;

            case GameState.NAME_ENTRY:
                this.subtitle = 'NEW HIGH SCORE!';
                this.playerName = '';
                this.cursorBlinkTime = 0;
                break;
        }
    }

    // -------------------------------------------------------------------------
    // SHUFFLE LOGIC
    // -------------------------------------------------------------------------
    generateShufflePlan() {
        this.shufflePlan = [];

        let numSwaps, swapDuration;

        if (this.level === 1) {
            numSwaps = 3;
            swapDuration = 450;
        } else if (this.level === 2) {
            numSwaps = 5;
            swapDuration = 380;
        } else if (this.level <= 5) {
            numSwaps = 5 + this.level;
            swapDuration = Math.max(220, 380 - (this.level - 2) * 40);
        } else {
            numSwaps = 10 + Math.floor((this.level - 5) / 2);
            swapDuration = 220;
        }

        // Generate swaps using SLOT indices (not cup IDs)
        for (let i = 0; i < numSwaps; i++) {
            const slot1 = this.rng.nextInt(0, 2);
            let slot2 = this.rng.nextInt(0, 2);
            while (slot2 === slot1) {
                slot2 = this.rng.nextInt(0, 2);
            }

            this.shufflePlan.push({
                slotA: slot1,
                slotB: slot2,
                duration: swapDuration,
                isFakeout: false
            });
        }

        // Add fakeouts at level 4+
        // Fakeouts are fake movements where cups wiggle but don't actually swap
        if (this.level >= 4) {
            const numFakeouts = Math.min(this.level - 3, 4); // 1 at L4, 2 at L5, 3 at L6, 4 at L7+

            for (let i = 0; i < numFakeouts; i++) {
                // Pick a random position to insert the fakeout
                const insertIndex = this.rng.nextInt(1, this.shufflePlan.length - 1);
                // Pick a random slot to wiggle
                const fakeoutSlot = this.rng.nextInt(0, 2);

                this.shufflePlan.splice(insertIndex, 0, {
                    slotA: fakeoutSlot,
                    slotB: -1, // -1 indicates fakeout (no second slot)
                    duration: swapDuration * 0.6, // Faster than real swaps
                    isFakeout: true
                });
            }
        }
    }

    async executeShufflePlan() {
        for (let i = 0; i < this.shufflePlan.length; i++) {
            const move = this.shufflePlan[i];

            if (move.isFakeout) {
                // Fakeout: wiggle a cup without swapping
                await this.doFakeout(move.slotA, move.duration);
            } else {
                // Real swap
                await this.startSwap(move.slotA, move.slotB, move.duration);
            }
        }

        // Shuffling complete
        this.setState(GameState.GUESS);
    }

    // Fakeout animation - cup wiggles but doesn't swap
    doFakeout(slotIndex, duration) {
        return new Promise((resolve) => {
            const cupId = this.slotToCup[slotIndex];
            const cup = this.cups[cupId];
            const startX = cup.renderX;
            const startY = cup.renderY;
            const wiggleAmount = 35;

            cup.z = 1; // Draw on top during fakeout

            // Animate wiggle: move right, then back
            cup.fromX = startX;
            cup.fromY = startY;
            cup.toX = startX + wiggleAmount;
            cup.toY = startY;
            cup.animT = 0;
            cup.animDuration = duration / 2;
            cup.arcHeight = 25; // Small hop
            cup.animating = true;

            const checkFirstHalf = () => {
                if (!cup.animating) {
                    // Second half: return to start
                    cup.fromX = cup.renderX;
                    cup.fromY = cup.renderY;
                    cup.toX = startX;
                    cup.toY = startY;
                    cup.animT = 0;
                    cup.animDuration = duration / 2;
                    cup.arcHeight = 25;
                    cup.animating = true;

                    const checkSecondHalf = () => {
                        if (!cup.animating) {
                            // Snap back to exact slot position
                            cup.snapToSlot(slotIndex);
                            cup.z = 0;
                            resolve();
                        } else {
                            requestAnimationFrame(checkSecondHalf);
                        }
                    };
                    requestAnimationFrame(checkSecondHalf);
                } else {
                    requestAnimationFrame(checkFirstHalf);
                }
            };
            requestAnimationFrame(checkFirstHalf);
        });
    }

    // -------------------------------------------------------------------------
    // GAME FLOW
    // -------------------------------------------------------------------------
    startNewRound() {
        this.resetMappings();

        // Randomize Morph's starting cup
        this.morphCupId = this.rng.nextInt(0, 2);
        this.morphVisible = false;

        this.setState(GameState.REVEAL_START);
    }

    resetGame() {
        this.score = 0;
        this.level = 1;
        this.chances = CONFIG.INITIAL_CHANCES;
        this.round = 1;
        this.streak = 0;
        this.morphCupId = 1;
        this.morphVisible = false;
        this.isSwapping = false;
        this.rng.setSeed(Date.now());

        this.resetMappings();
        this.setState(GameState.INTRO);
    }

    // -------------------------------------------------------------------------
    // INPUT HANDLING
    // -------------------------------------------------------------------------
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (CONFIG.WIDTH / rect.width);
        const y = (e.clientY - rect.top) * (CONFIG.HEIGHT / rect.height);

        if (this.state === GameState.INTRO) {
            // Check against render positions
            for (const cup of this.cups) {
                if (cup.containsPoint(x, y)) {
                    this.morphCupId = cup.id;
                    this.setState(GameState.REVEAL_START);
                    return;
                }
            }
        } else if (this.state === GameState.GUESS) {
            // ONLY allow clicks in GUESS state, check all cups aren't animating
            const anyAnimating = this.cups.some(c => c.animating);
            if (anyAnimating) return;

            for (const cup of this.cups) {
                if (cup.containsPoint(x, y)) {
                    this.selectedCupId = cup.id;
                    this.guessCorrect = (cup.id === this.morphCupId);
                    this.setState(GameState.REVEAL_RESULT);
                    return;
                }
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (CONFIG.WIDTH / rect.width);
        const y = (e.clientY - rect.top) * (CONFIG.HEIGHT / rect.height);

        this.hoveredCupId = -1;

        if (this.state === GameState.INTRO || this.state === GameState.GUESS) {
            for (const cup of this.cups) {
                if (cup.containsPoint(x, y)) {
                    this.hoveredCupId = cup.id;
                    break;
                }
            }
        }

        this.canvas.style.cursor = this.hoveredCupId >= 0 ? 'pointer' : 'default';
    }

    handleKeyDown(e) {
        // Name entry mode
        if (this.state === GameState.NAME_ENTRY) {
            if (e.key === 'Enter' && this.playerName.length > 0) {
                // Submit name
                const rank = this.leaderboard.addEntry(this.playerName, this.score, this.level);
                this.showLeaderboard = true;
                this.subtitle = `RANK #${rank} - PRESS R TO PLAY AGAIN`;
                this.state = GameState.GAME_OVER;
            } else if (e.key === 'Backspace') {
                this.playerName = this.playerName.slice(0, -1);
                e.preventDefault();
            } else if (e.key.length === 1 && this.playerName.length < MAX_NAME_LENGTH) {
                // Only allow letters, numbers, and some symbols
                const char = e.key.toUpperCase();
                if (/^[A-Z0-9!?._-]$/.test(char)) {
                    this.playerName += char;
                }
            }
            return;
        }

        // Normal controls
        if (e.key === 'r' || e.key === 'R') {
            this.showLeaderboard = false;
            this.resetGame();
        } else if (e.key === 'd' || e.key === 'D') {
            this.debugMode = !this.debugMode;
        } else if (e.key === 'l' || e.key === 'L') {
            this.showLeaderboard = !this.showLeaderboard;
        }
    }

    // -------------------------------------------------------------------------
    // GAME LOOP
    // -------------------------------------------------------------------------
    gameLoop() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    update(deltaTime) {
        for (const cup of this.cups) {
            cup.update(deltaTime);
        }

        // Update cursor blink for name entry
        if (this.state === GameState.NAME_ENTRY) {
            this.cursorBlinkTime += deltaTime;
        }

        // Update morph animation
        if (this.useDomMorph) {
            // DOM element animates automatically, just update position
            this.updateMorphDomPosition();
        } else if (this.morphAnimator) {
            // Sprite sheet animator - only animate when visible
            this.morphAnimator.setPaused(!this.morphVisible);
            if (this.morphVisible) {
                this.morphAnimator.update(deltaTime / 1000); // Convert ms to seconds
            }
        }
    }

    // -------------------------------------------------------------------------
    // RENDERING
    // -------------------------------------------------------------------------
    render() {
        const ctx = this.ctx;

        this.drawBackground(ctx);

        // Draw platform
        this.assets.draw(ctx, 'platform', CONFIG.WIDTH / 2, CONFIG.CUP_Y + 100, 600, 120);

        // Debug: draw slot markers
        if (this.debugMode) {
            this.drawSlotMarkers(ctx);
        }

        // Sort cups by z-order for proper layering
        const sortedCups = [...this.cups].sort((a, b) => a.z - b.z);

        // Draw cup shadows first
        for (const cup of sortedCups) {
            if (cup.liftAmount > 0) {
                this.assets.drawCupShadow(ctx, cup.renderX, cup.renderY, cup.width, cup.height, cup.liftAmount);
            }
        }

        // Draw Morph if visible
        if (this.morphVisible) {
            const morphCup = this.cups[this.morphCupId];
            const morphX = morphCup.renderX;
            const morphY = morphCup.renderY + CONFIG.CUP_HEIGHT / 2 - 20;

            // If using DOM element for animation, it's handled by updateMorphDomPosition()
            if (this.useDomMorph) {
                // DOM element is positioned in update(), nothing to draw on canvas
            } else if (this.morphAnimator) {
                // Use sprite sheet animator
                this.morphAnimator.draw(ctx, morphX, morphY, MORPH_SPRITE_CONFIG.scale, 'center');

                // Debug: show sprite info
                if (this.debugMode) {
                    const img = this.morphAnimator.image;
                    ctx.fillStyle = '#ff0';
                    ctx.font = '12px monospace';
                    ctx.fillText(`Sheet: ${img.naturalWidth}x${img.naturalHeight}`, morphX - 50, morphY + 60);
                    ctx.fillText(`Frame: ${MORPH_SPRITE_CONFIG.frameWidth}x${MORPH_SPRITE_CONFIG.frameHeight}`, morphX - 50, morphY + 75);
                    ctx.fillText(`Scale: ${MORPH_SPRITE_CONFIG.scale}`, morphX - 50, morphY + 90);
                }
            } else {
                // Fallback to placeholder
                this.assets.draw(ctx, 'morph', morphX, morphY,
                    CONFIG.MORPH_WIDTH, CONFIG.MORPH_HEIGHT);
            }
        }

        // Draw cup bodies
        for (const cup of sortedCups) {
            const highlight = cup.id === this.hoveredCupId &&
                (this.state === GameState.INTRO || this.state === GameState.GUESS);
            this.assets.draw(ctx, 'cup', cup.renderX, cup.renderY, cup.width, cup.height, {
                highlight: highlight,
                liftAmount: cup.liftAmount
            });
        }

        this.drawUI(ctx);

        // Draw name entry screen
        if (this.state === GameState.NAME_ENTRY) {
            this.drawNameEntry(ctx);
        }

        // Draw leaderboard overlay
        if (this.showLeaderboard) {
            this.drawLeaderboard(ctx);
        }

        if (this.debugMode) {
            this.drawDebug(ctx);
        }
    }

    drawSlotMarkers(ctx) {
        ctx.save();
        for (let i = 0; i < 3; i++) {
            const slot = SLOTS[i];

            // Draw slot rectangle
            ctx.fillStyle = CONFIG.COLORS.debugSlot;
            ctx.fillRect(slot.x - CONFIG.CUP_WIDTH/2, slot.y - CONFIG.CUP_HEIGHT/2,
                CONFIG.CUP_WIDTH, CONFIG.CUP_HEIGHT);

            // Draw slot index
            ctx.fillStyle = '#ff0';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`SLOT ${i}`, slot.x, slot.y - CONFIG.CUP_HEIGHT/2 - 10);
        }
        ctx.restore();
    }

    drawBackground(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
        gradient.addColorStop(0, CONFIG.COLORS.backgroundGradientTop);
        gradient.addColorStop(1, CONFIG.COLORS.backgroundGradientBottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(CONFIG.WIDTH, 0);
        ctx.lineTo(CONFIG.WIDTH, 120);
        ctx.quadraticCurveTo(CONFIG.WIDTH * 0.75, 150, CONFIG.WIDTH / 2, 130);
        ctx.quadraticCurveTo(CONFIG.WIDTH * 0.25, 110, 0, 140);
        ctx.closePath();
        ctx.fill();
    }

    drawUI(ctx) {
        ctx.save();
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = CONFIG.COLORS.title;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText("MORPH'S CUP SHUFFLE", CONFIG.WIDTH / 2, CONFIG.TITLE_Y);
        ctx.restore();

        ctx.save();
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = CONFIG.COLORS.subtitle;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.subtitle, CONFIG.WIDTH / 2, CONFIG.SUBTITLE_Y);
        ctx.restore();

        // HUD
        ctx.save();
        const hudGradient = ctx.createLinearGradient(150, CONFIG.HUD_Y - 30, 150, CONFIG.HUD_Y + 30);
        hudGradient.addColorStop(0, 'rgba(30, 50, 80, 0.9)');
        hudGradient.addColorStop(1, 'rgba(20, 30, 50, 0.9)');
        ctx.fillStyle = hudGradient;

        const hudWidth = 500;
        const hudHeight = 60;
        const hudX = CONFIG.WIDTH / 2 - hudWidth / 2;
        const hudY = CONFIG.HUD_Y - hudHeight / 2;

        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudWidth, hudHeight, 30);
        ctx.fill();

        ctx.strokeStyle = 'rgba(100, 150, 200, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudText;
        ctx.fillText(this.chances.toString(), CONFIG.WIDTH / 2 - 150, CONFIG.HUD_Y - 5);
        ctx.font = '14px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudLabel;
        ctx.fillText('CHANCES', CONFIG.WIDTH / 2 - 150, CONFIG.HUD_Y + 18);

        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudText;
        ctx.fillText(this.score.toString(), CONFIG.WIDTH / 2, CONFIG.HUD_Y - 5);
        ctx.font = '14px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudLabel;
        ctx.fillText('SCORE', CONFIG.WIDTH / 2, CONFIG.HUD_Y + 18);

        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudText;
        ctx.fillText(this.level.toString(), CONFIG.WIDTH / 2 + 150, CONFIG.HUD_Y - 5);
        ctx.font = '14px Arial';
        ctx.fillStyle = CONFIG.COLORS.hudLabel;
        ctx.fillText('LEVEL', CONFIG.WIDTH / 2 + 150, CONFIG.HUD_Y + 18);

        ctx.restore();
    }

    drawNameEntry(ctx) {
        // Semi-transparent overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        const centerX = CONFIG.WIDTH / 2;
        const centerY = CONFIG.HEIGHT / 2;

        // Title
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NEW HIGH SCORE!', centerX, centerY - 150);

        // Score display
        ctx.font = 'bold 64px Arial';
        ctx.fillStyle = CONFIG.COLORS.title;
        ctx.fillText(this.score.toString(), centerX, centerY - 80);

        ctx.font = '24px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText(`LEVEL ${this.level}`, centerX, centerY - 40);

        // Name entry prompt
        ctx.font = '28px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText('ENTER YOUR NAME:', centerX, centerY + 30);

        // Name input box
        const boxWidth = 300;
        const boxHeight = 60;
        ctx.strokeStyle = CONFIG.COLORS.title;
        ctx.lineWidth = 3;
        ctx.strokeRect(centerX - boxWidth/2, centerY + 60, boxWidth, boxHeight);

        // Blinking cursor
        const showCursor = Math.floor(this.cursorBlinkTime / 500) % 2 === 0;

        // Player name
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        const displayName = this.playerName + (showCursor ? '_' : '');
        ctx.fillText(displayName, centerX, centerY + 98);

        // Instructions
        ctx.font = '18px Arial';
        ctx.fillStyle = '#888';
        ctx.fillText('TYPE YOUR NAME AND PRESS ENTER', centerX, centerY + 160);

        ctx.restore();
    }

    drawLeaderboard(ctx) {
        ctx.save();

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        const centerX = CONFIG.WIDTH / 2;
        const startY = 100;

        // Title
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = CONFIG.COLORS.title;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LEADERBOARD', centerX, startY);

        const entries = this.leaderboard.getEntries();

        if (entries.length === 0) {
            ctx.font = '24px Arial';
            ctx.fillStyle = '#888';
            ctx.fillText('NO SCORES YET', centerX, startY + 100);
            ctx.fillText('BE THE FIRST!', centerX, startY + 140);
        } else {
            // Column headers
            ctx.font = 'bold 20px Arial';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'left';
            ctx.fillText('RANK', centerX - 200, startY + 60);
            ctx.fillText('NAME', centerX - 100, startY + 60);
            ctx.textAlign = 'right';
            ctx.fillText('LVL', centerX + 120, startY + 60);
            ctx.fillText('SCORE', centerX + 200, startY + 60);

            // Entries
            entries.forEach((entry, index) => {
                const y = startY + 100 + index * 40;
                const isRecent = entry.name === this.playerName.toUpperCase() &&
                                 entry.score === this.score;

                ctx.font = isRecent ? 'bold 24px monospace' : '24px monospace';
                ctx.fillStyle = isRecent ? '#ffd700' : '#fff';

                // Rank
                ctx.textAlign = 'left';
                const rankText = `#${index + 1}`;
                ctx.fillText(rankText, centerX - 200, y);

                // Name
                ctx.fillText(entry.name, centerX - 100, y);

                // Level
                ctx.textAlign = 'right';
                ctx.fillText(entry.level.toString(), centerX + 120, y);

                // Score
                ctx.fillText(entry.score.toString(), centerX + 200, y);
            });
        }

        // Instructions
        ctx.font = '20px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS L TO CLOSE  |  PRESS R TO PLAY', centerX, CONFIG.HEIGHT - 50);

        ctx.restore();
    }

    drawDebug(ctx) {
        ctx.save();
        ctx.font = '14px monospace';
        ctx.fillStyle = CONFIG.COLORS.debugText;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const lines = [
            `State: ${this.state}`,
            `isSwapping: ${this.isSwapping}`,
            `Morph under CUP ID: ${this.morphCupId}`,
            `Morph visible: ${this.morphVisible}`,
            '',
            'MAPPINGS:',
            `cupToSlot: [${this.cupToSlot.join(', ')}]`,
            `slotToCup: [${this.slotToCup.join(', ')}]`,
            '',
            'CUPS:'
        ];

        for (let i = 0; i < 3; i++) {
            const cup = this.cups[i];
            const slot = this.cupToSlot[i];
            lines.push(`  Cup ${i}: slot=${slot}, render=(${Math.round(cup.renderX)},${Math.round(cup.renderY)}), anim=${cup.animating}, z=${cup.z}`);
        }

        lines.push('');
        lines.push('SLOTS:');
        for (let i = 0; i < 3; i++) {
            const cupId = this.slotToCup[i];
            lines.push(`  Slot ${i}: cupId=${cupId}, pos=(${SLOTS[i].x},${SLOTS[i].y})`);
        }

        lines.push('');
        const planStr = this.shufflePlan.map(s =>
            s.isFakeout ? `F${s.slotA}` : `${s.slotA}-${s.slotB}`
        ).join(', ');
        lines.push(`Shuffle plan: ${planStr}`);

        lines.forEach((line, i) => {
            ctx.fillText(line, 10, 160 + i * 16);
        });

        ctx.restore();
    }
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
window.addEventListener('load', async () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new CupShuffleGame(canvas);

    // Load assets
    await game.assets.loadAll();

    // Check for DOM-based animated morph first (preferred for webp/gif)
    const morphDomEl = document.getElementById('morphSprite');
    if (morphDomEl && morphDomEl.complete && morphDomEl.naturalWidth > 0) {
        game.morphDomElement = morphDomEl;
        game.useDomMorph = true;
        console.log('Using DOM element for Morph animation (webp/gif)');
    }
    // Fallback to sprite sheet animator
    else if (game.assets.images.morphSheet) {
        game.morphAnimator = new SpriteSheetAnimator(
            game.assets.images.morphSheet,
            MORPH_SPRITE_CONFIG.frameWidth,
            MORPH_SPRITE_CONFIG.frameHeight,
            MORPH_SPRITE_CONFIG.totalFrames,
            MORPH_SPRITE_CONFIG.columns,
            MORPH_SPRITE_CONFIG.fps
        );
        game.useDomMorph = false;
        console.log('Using sprite sheet for Morph animation');
    } else {
        game.useDomMorph = false;
        console.log('No Morph animation found, using placeholder');
    }

    window.game = game;
});
