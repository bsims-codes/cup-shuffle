Build a “cup shuffle” minigame (like the attached WALL-E Cup Shuffle screen) in plain JavaScript using a single HTML5 canvas (no external libraries, no CDNs). Package as index.html, game.js, and an assets/ folder (images optional for v1). Fixed logical resolution 900×700 (or 800×600 if you prefer) with no CSS scaling. Design it so placeholder graphics (simple shapes) can be replaced later with image assets for cups, Morph, background, and UI.

Game concept:

3 cups in a row.

Morph (a small blob/character) starts under one cup.

Player watches a shuffle animation.

Then clicks a cup to guess where Morph is.

Score/level increase on correct; chances decrease on wrong; level increases difficulty (more swaps, faster swaps, optional fakeouts).

Morph is “from Treasure Planet” theming later; for v1 render Morph as a small colored blob with eyes or a simple circle.

Core requirements:

Architecture / state machine:

States: INTRO (choose your cup / start), REVEAL_START (show Morph placement briefly), SHUFFLING, GUESS, REVEAL_RESULT, ROUND_END, GAME_OVER.

No logic should be “ad hoc.” Use a clear setState(nextState) and per-state timers.

Data model:

Cups array: 3 cups with id, x, y, w, h, z (for draw order), and animation properties.

Morph has cupId and optional visible flag (only visible during reveals).

Track score, level, chances, round, streak.

Shuffle algorithm (deterministic + fair):

Use a seeded RNG (LCG) so shuffles are repeatable with the same seed.

For each shuffle step, pick two distinct cup indices to swap positions.

Precompute a “shuffle plan” list of swaps per round based on level:

Level 1: 3 swaps, slow

Level 2: 5 swaps

Level 3+: 7–10 swaps, faster

Optionally add a “fakeout” animation at higher levels (cups wiggle) but do NOT change the actual swap mapping.

Animation:

Animate swaps smoothly using tweening over time (e.g., 450ms per swap at level 1 down to 220ms).

During a swap, cups follow a slight arc (not just linear) for a polished feel.

Ensure no cup overlap artifacts by managing draw order (the moving cup can be drawn above).

Interaction:

Click/tap selects a cup only during GUESS.

Hover highlight is optional.

Disable input during shuffle and reveal.

Visual system (asset-friendly):

Implement an Assets helper with draw(name, x, y, w, h) that:

If image exists in assets/, draws it.

Otherwise draws a placeholder (cups as rounded rectangles; Morph as blob).

Keep all layout constants at top: cup positions, sizes, UI bar positions.

UI:

Title text at top.

Center subtitle prompts (“CHOOSE YOUR CUP!”, “WATCH CLOSELY”, “PICK A CUP”).

Bottom HUD: chances, score, level.

Restart key: R.

Debug toggle: D shows Morph’s current cupId and shuffle plan.

Reveal logic:

At round start, lift the Morph cup slightly and show Morph for 1 second, then cover.

After guess, lift chosen cup; if correct show Morph under it; if wrong reveal correct cup after a short delay.

Deliverables:

Provide full working index.html + game.js.

Must run locally via a simple static server and on GitHub Pages.

No build step.

Polish constraints:

Make it feel smooth and “game-like” even with placeholder art.

Do not overcomplicate: keep it stable and deterministic first.