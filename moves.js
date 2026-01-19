// Dance Move Catalog with SVG Pictograms
const MOVE_CATALOG = {
    'step_touch': {
        name: 'Step Touch',
        difficulty: 1,
        bodyPart: 'Legs',
        defaultBeats: 8,
        description: 'Step to the side and touch feet together',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <line x1="50" y1="35" x2="50" y2="80" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="25" y2="65" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="75" y2="65" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="30" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="70" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M25 125 L35 130" stroke="#FF2D78" stroke-width="4" stroke-linecap="round"/>
            <path d="M75 125 L65 130" stroke="#FF2D78" stroke-width="4" stroke-linecap="round"/>
        </svg>`
    },
    'body_roll': {
        name: 'Body Roll',
        difficulty: 2,
        bodyPart: 'Full Body',
        defaultBeats: 8,
        description: 'Roll your body in a wave motion from chest to hips',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <path d="M50 35 Q55 50 50 65 Q45 80 50 95" stroke="white" stroke-width="6" stroke-linecap="round" fill="none"/>
            <line x1="50" y1="50" x2="30" y2="45" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="70" y2="45" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="95" x2="35" y2="135" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="95" x2="65" y2="135" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M40 55 C35 60 35 70 40 75" stroke="#FFE135" stroke-width="3" stroke-linecap="round" fill="none"/>
        </svg>`
    },
    'arm_wave': {
        name: 'Arm Wave',
        difficulty: 2,
        bodyPart: 'Arms',
        defaultBeats: 8,
        description: 'Create a wave motion from one hand across to the other',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M50 55 Q30 45 15 35" stroke="white" stroke-width="6" stroke-linecap="round" fill="none"/>
            <path d="M50 55 Q70 45 85 55" stroke="white" stroke-width="6" stroke-linecap="round" fill="none"/>
            <line x1="50" y1="90" x2="35" y2="135" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="135" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M20 30 Q50 25 80 50" stroke="#FF2D78" stroke-width="3" stroke-dasharray="5,5" fill="none"/>
        </svg>`
    },
    'hip_sway': {
        name: 'Hip Sway',
        difficulty: 1,
        bodyPart: 'Hips',
        defaultBeats: 4,
        description: 'Sway your hips side to side in rhythm',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <line x1="50" y1="35" x2="50" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <ellipse cx="50" cy="75" rx="20" ry="12" stroke="white" stroke-width="6" fill="none"/>
            <line x1="50" y1="50" x2="30" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="70" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="40" y1="85" x2="30" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="60" y1="85" x2="70" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M25 75 L75 75" stroke="#FF2D78" stroke-width="3" stroke-dasharray="5,5"/>
        </svg>`
    },
    'clap': {
        name: 'Clap',
        difficulty: 1,
        bodyPart: 'Arms',
        defaultBeats: 4,
        description: 'Clap your hands together on the beat',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <line x1="50" y1="35" x2="50" y2="85" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="35" y2="35" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="65" y2="35" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="85" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="85" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <circle cx="50" cy="30" r="8" fill="none" stroke="#FFE135" stroke-width="2"/>
            <line x1="42" y1="22" x2="38" y2="18" stroke="#FFE135" stroke-width="2"/>
            <line x1="50" y1="20" x2="50" y2="14" stroke="#FFE135" stroke-width="2"/>
            <line x1="58" y1="22" x2="62" y2="18" stroke="#FFE135" stroke-width="2"/>
        </svg>`
    },
    'turn': {
        name: 'Turn',
        difficulty: 2,
        bodyPart: 'Full Body',
        defaultBeats: 8,
        description: 'Spin around in a full circle',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="30" y2="70" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="70" y2="70" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M75 70 A30 30 0 1 1 75 71" stroke="#FF2D78" stroke-width="3" fill="none" stroke-dasharray="8,4"/>
            <polygon points="80,65 85,75 75,75" fill="#FF2D78"/>
        </svg>`
    },
    'jump': {
        name: 'Jump',
        difficulty: 2,
        bodyPart: 'Full Body',
        defaultBeats: 4,
        description: 'Jump up with energy on the beat',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="80" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="25" y2="40" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="75" y2="40" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="30" y2="110" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="70" y2="110" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="20" y1="130" x2="80" y2="130" stroke="rgba(255,255,255,0.3)" stroke-width="4" stroke-linecap="round"/>
            <path d="M35 120 L50 105 L65 120" stroke="#FFE135" stroke-width="3" fill="none"/>
            <path d="M40 125 L50 115 L60 125" stroke="#FFE135" stroke-width="2" fill="none"/>
        </svg>`
    },
    'slide': {
        name: 'Slide',
        difficulty: 1,
        bodyPart: 'Legs',
        defaultBeats: 4,
        description: 'Slide your feet smoothly to one side',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="55" cy="20" r="15" fill="#00D4FF"/>
            <line x1="55" y1="35" x2="55" y2="80" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="55" y1="50" x2="35" y2="65" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="55" y1="50" x2="75" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="55" y1="80" x2="45" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="55" y1="80" x2="75" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M30 130 L80 130" stroke="#FF2D78" stroke-width="3"/>
            <polygon points="80,125 90,130 80,135" fill="#FF2D78"/>
        </svg>`
    },
    'shoulder_pop': {
        name: 'Shoulder Pop',
        difficulty: 1,
        bodyPart: 'Arms',
        defaultBeats: 4,
        description: 'Pop your shoulders up and down alternately',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="25" y2="45" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="75" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M20 40 L30 35 L20 30" stroke="#FFE135" stroke-width="3" fill="none"/>
            <path d="M80 55 L70 60 L80 65" stroke="#FFE135" stroke-width="3" fill="none"/>
        </svg>`
    },
    'snap': {
        name: 'Snap',
        difficulty: 1,
        bodyPart: 'Arms',
        defaultBeats: 4,
        description: 'Snap your fingers to the beat',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="30" y2="50" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="75" y2="45" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <circle cx="78" cy="40" r="5" fill="#FFE135"/>
            <line x1="78" y1="30" x2="78" y2="25" stroke="#FFE135" stroke-width="2"/>
            <line x1="85" y1="35" x2="90" y2="32" stroke="#FFE135" stroke-width="2"/>
            <line x1="87" y1="43" x2="92" y2="45" stroke="#FFE135" stroke-width="2"/>
        </svg>`
    },
    'point': {
        name: 'Point',
        difficulty: 1,
        bodyPart: 'Arms',
        defaultBeats: 4,
        description: 'Point in different directions with style',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="30" y2="70" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="85" y2="35" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <circle cx="90" cy="30" r="4" fill="#FF2D78"/>
        </svg>`
    },
    'stomp': {
        name: 'Stomp',
        difficulty: 1,
        bodyPart: 'Legs',
        defaultBeats: 4,
        description: 'Stomp your feet powerfully on the beat',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <line x1="50" y1="35" x2="50" y2="80" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="30" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="70" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="35" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="65" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <ellipse cx="35" cy="135" rx="15" ry="5" fill="#FF2D78" opacity="0.5"/>
            <line x1="20" y1="140" x2="25" y2="145" stroke="#FFE135" stroke-width="2"/>
            <line x1="35" y1="142" x2="35" y2="148" stroke="#FFE135" stroke-width="2"/>
            <line x1="50" y1="140" x2="45" y2="145" stroke="#FFE135" stroke-width="2"/>
        </svg>`
    },
    'groove': {
        name: 'Groove',
        difficulty: 1,
        bodyPart: 'Full Body',
        defaultBeats: 8,
        description: 'Feel the beat and move your whole body freely',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="22" r="15" fill="#00D4FF"/>
            <path d="M50 37 Q55 55 48 75 Q45 85 50 95" stroke="white" stroke-width="6" stroke-linecap="round" fill="none"/>
            <line x1="50" y1="52" x2="28" y2="48" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="52" x2="72" y2="56" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="95" x2="32" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="95" x2="68" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M20 60 Q25 55 30 60 Q35 65 40 60" stroke="#FFE135" stroke-width="2" fill="none"/>
            <path d="M60 65 Q65 60 70 65 Q75 70 80 65" stroke="#FFE135" stroke-width="2" fill="none"/>
        </svg>`
    },
    'sway': {
        name: 'Sway',
        difficulty: 1,
        bodyPart: 'Full Body',
        defaultBeats: 8,
        description: 'Gently sway your body side to side',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="55" cy="22" r="15" fill="#00D4FF"/>
            <line x1="55" y1="37" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="53" y1="52" x2="30" y2="60" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="53" y1="52" x2="75" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M35 50 Q50 45 65 50" stroke="#9B5DE5" stroke-width="2" stroke-dasharray="4,4" fill="none"/>
            <path d="M35 80 Q50 85 65 80" stroke="#9B5DE5" stroke-width="2" stroke-dasharray="4,4" fill="none"/>
        </svg>`
    },
    'punch': {
        name: 'Punch',
        difficulty: 2,
        bodyPart: 'Arms',
        defaultBeats: 4,
        description: 'Punch the air with power',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="25" r="15" fill="#00D4FF"/>
            <line x1="50" y1="40" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="30" y2="70" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="55" x2="90" y2="45" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <circle cx="93" cy="43" r="6" fill="#FF2D78"/>
            <line x1="85" y1="35" x2="80" y2="30" stroke="#FFE135" stroke-width="2"/>
            <line x1="93" y1="33" x2="93" y2="27" stroke="#FFE135" stroke-width="2"/>
            <line x1="100" y1="38" x2="105" y2="35" stroke="#FFE135" stroke-width="2"/>
        </svg>`
    },
    'shimmy': {
        name: 'Shimmy',
        difficulty: 2,
        bodyPart: 'Arms',
        defaultBeats: 8,
        description: 'Shake your shoulders rapidly back and forth',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="22" r="15" fill="#00D4FF"/>
            <line x1="50" y1="37" x2="50" y2="90" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="25" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="75" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="35" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="90" x2="65" y2="130" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M20 48 L30 52 L20 56" stroke="#FFE135" stroke-width="2" fill="none"/>
            <path d="M80 48 L70 52 L80 56" stroke="#FFE135" stroke-width="2" fill="none"/>
            <path d="M22 58 L28 62 L22 66" stroke="#FFE135" stroke-width="2" fill="none"/>
            <path d="M78 58 L72 62 L78 66" stroke="#FFE135" stroke-width="2" fill="none"/>
        </svg>`
    },
    'twist': {
        name: 'Twist',
        difficulty: 1,
        bodyPart: 'Hips',
        defaultBeats: 8,
        description: 'Twist your hips and feet like the classic dance',
        pictogram: `<svg viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="20" r="15" fill="#00D4FF"/>
            <line x1="50" y1="35" x2="50" y2="80" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="30" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="50" x2="70" y2="55" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="30" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <line x1="50" y1="80" x2="70" y2="125" stroke="white" stroke-width="6" stroke-linecap="round"/>
            <path d="M25 130 A5 5 0 0 1 35 130" stroke="#FF2D78" stroke-width="2" fill="none"/>
            <path d="M65 130 A5 5 0 0 0 75 130" stroke="#FF2D78" stroke-width="2" fill="none"/>
            <ellipse cx="50" cy="82" rx="12" ry="5" stroke="#9B5DE5" stroke-width="2" fill="none" stroke-dasharray="3,3"/>
        </svg>`
    }
};

// Get all move keys for random selection
const MOVE_KEYS = Object.keys(MOVE_CATALOG);

// Difficulty descriptions
const DIFFICULTY_LABELS = {
    1: 'Easy',
    2: 'Medium',
    3: 'Hard'
};

// Contextual messages based on song characteristics
const CONTEXTUAL_MESSAGES = {
    start: [
        "Let's get moving!",
        "Get ready to dance!",
        "Here we go!",
        "Time to shine!"
    ],
    energetic: [
        "Feel the energy!",
        "You're on fire!",
        "Keep that energy up!",
        "Let's go!"
    ],
    slow: [
        "Feel the groove...",
        "Nice and smooth...",
        "Take it easy...",
        "Flow with it..."
    ],
    transition: [
        "New move coming!",
        "Switch it up!",
        "Here comes the next one!",
        "Change incoming!"
    ],
    oldSong: [
        "Ooh, a classic!",
        "Throwback time!",
        "Old school vibes!",
        "Retro magic!"
    ],
    upbeat: [
        "This'll be fun!",
        "What a banger!",
        "Great choice!",
        "Let's party!"
    ],
    encourage: [
        "You're doing great!",
        "Keep it up!",
        "Looking good!",
        "Nice moves!"
    ],
    finish: [
        "Almost there!",
        "Final stretch!",
        "Finish strong!",
        "Last moves!"
    ]
};

// Helper to get random message from category
function getRandomMessage(category) {
    const messages = CONTEXTUAL_MESSAGES[category];
    return messages[Math.floor(Math.random() * messages.length)];
}

// Helper to generate star HTML for difficulty
function generateStars(difficulty) {
    let html = '';
    for (let i = 1; i <= 3; i++) {
        html += `<span class="star ${i <= difficulty ? 'filled' : ''}">&#x2605;</span>`;
    }
    return html;
}

// Export for use in app.js
window.MOVE_CATALOG = MOVE_CATALOG;
window.MOVE_KEYS = MOVE_KEYS;
window.DIFFICULTY_LABELS = DIFFICULTY_LABELS;
window.CONTEXTUAL_MESSAGES = CONTEXTUAL_MESSAGES;
window.getRandomMessage = getRandomMessage;
window.generateStars = generateStars;
