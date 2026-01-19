// Dance Card Generator - Main Application

// State
let player = null;
let playerReady = false;
let currentRoutine = [];
let currentMoveIndex = 0;
let isPlaying = false;
let videoDuration = 0;
let updateInterval = null;
let playbackSpeed = 1;
const speeds = [0.5, 0.75, 1, 1.25, 1.5];
let currentSpeedIndex = 2;

// Current song state
let currentVideoId = null;
let currentSongInfo = null;
let currentChoreography = null;
let isFromCache = false;

// DOM Elements
const screens = {
    input: document.getElementById('input-screen'),
    loading: document.getElementById('loading-screen'),
    dance: document.getElementById('dance-screen'),
    complete: document.getElementById('complete-screen')
};

const elements = {
    youtubeUrl: document.getElementById('youtube-url'),
    generateBtn: document.getElementById('generate-btn'),
    apiKey: document.getElementById('api-key'),
    toggleApiKey: document.getElementById('toggle-api-key'),
    apiKeyContainer: document.getElementById('api-key-container'),
    errorMessage: document.getElementById('error-message'),
    loadingText: document.getElementById('loading-text'),
    backBtn: document.getElementById('back-btn'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    songVibe: document.getElementById('song-vibe'),
    savedBadge: document.getElementById('saved-badge'),
    regenerateBtn: document.getElementById('regenerate-btn'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    moveMarkers: document.getElementById('move-markers'),
    timeDisplay: document.getElementById('time-display'),
    speedBtn: document.getElementById('speed-btn'),
    contextualMessage: document.getElementById('contextual-message'),
    currentPictogram: document.getElementById('current-pictogram'),
    currentMoveName: document.getElementById('current-move-name'),
    currentBodyPart: document.getElementById('current-body-part'),
    currentBeats: document.getElementById('current-beats'),
    nextPictogram: document.getElementById('next-pictogram'),
    nextMoveName: document.getElementById('next-move-name'),
    moveDots: document.getElementById('move-dots'),
    replayBtn: document.getElementById('replay-btn'),
    newSongBtn: document.getElementById('new-song-btn'),
    // Lyrics elements
    lyricsSection: document.querySelector('.lyrics-section'),
    toggleLyricsBtn: document.getElementById('toggle-lyrics-btn'),
    lyricsContent: document.getElementById('lyrics-content')
};

// Initialize YouTube API
function initYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Called by YouTube API when ready
window.onYouTubeIframeAPIReady = function() {
    playerReady = true;
};

// Extract video ID from YouTube URL
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Fetch video info using YouTube oEmbed API
async function fetchVideoInfo(videoId) {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (!response.ok) throw new Error('Video not found');
        const data = await response.json();

        // Parse title to extract song and artist
        let title = data.title;
        let artist = data.author_name;

        // Common patterns: "Artist - Song", "Song - Artist", "Song (Official Video)"
        const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[].*)?$/);
        if (dashMatch) {
            // Check which part is more likely the artist
            if (dashMatch[1].toLowerCase().includes('official') ||
                dashMatch[1].toLowerCase().includes('lyric') ||
                dashMatch[1].toLowerCase().includes('video')) {
                title = dashMatch[2];
            } else {
                artist = dashMatch[1];
                title = dashMatch[2].replace(/\s*[\(\[].*$/, ''); // Remove (Official Video) etc
            }
        }

        // Clean up title
        title = title.replace(/\s*[\(\[](?:official|lyric|music|video|audio|hd|4k|remaster).*[\)\]]/gi, '').trim();

        return { title, artist, fullTitle: data.title };
    } catch (error) {
        console.error('Error fetching video info:', error);
        return { title: 'Unknown Song', artist: 'Unknown Artist', fullTitle: '' };
    }
}

// Generate choreography using Claude API
async function generateChoreography(songInfo, apiKey) {
    const prompt = `You are a dance choreographer creating a beginner-friendly dance routine for the song "${songInfo.title}" by ${songInfo.artist}.

Create a sequence of 10-12 dance moves that would fit this song. Consider the likely tempo, energy, and vibe of the song based on its title and artist.

Available moves (use ONLY these exact move IDs):
- step_touch: Step Touch (Easy, Legs)
- body_roll: Body Roll (Medium, Full Body)
- arm_wave: Arm Wave (Medium, Arms)
- hip_sway: Hip Sway (Easy, Hips)
- clap: Clap (Easy, Arms)
- turn: Turn (Medium, Full Body)
- jump: Jump (Medium, Full Body)
- slide: Slide (Easy, Legs)
- shoulder_pop: Shoulder Pop (Easy, Arms)
- snap: Snap (Easy, Arms)
- point: Point (Easy, Arms)
- stomp: Stomp (Easy, Legs)
- groove: Groove (Easy, Full Body)
- sway: Sway (Easy, Full Body)
- punch: Punch (Medium, Arms)
- shimmy: Shimmy (Medium, Arms)
- twist: Twist (Easy, Hips)

Return a JSON object with this exact structure:
{
  "songVibe": "one of: energetic, chill, emotional, fun, intense",
  "estimatedBPM": number between 60-180,
  "moves": [
    {
      "moveId": "exact move ID from list above",
      "beats": 4 or 8,
      "startTime": time in seconds when this move starts (spread evenly across a 3-minute song, or adjust if you know the song length)
    }
  ]
}

Rules:
1. Start with simpler moves (step_touch, sway, groove) to warm up
2. Build energy through the middle with more dynamic moves
3. Match move intensity to likely song sections (verse=simpler, chorus=bigger moves)
4. End with memorable moves
5. Vary the body parts used - don't do too many arm moves in a row
6. For slower songs, use more sway, groove, body_roll, arm_wave
7. For faster songs, use more jump, stomp, clap, punch
8. Space moves evenly, assuming ~3 minute song if unknown

Return ONLY the JSON object, no other text.`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        const content = data.content[0].text;

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format');

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Error generating choreography:', error);
        throw error;
    }
}

// Generate fallback choreography if API fails
function generateFallbackChoreography() {
    const vibes = ['energetic', 'fun', 'chill'];
    const vibe = vibes[Math.floor(Math.random() * vibes.length)];

    const easyMoves = ['step_touch', 'hip_sway', 'clap', 'slide', 'snap', 'point', 'stomp', 'groove', 'sway', 'twist'];
    const mediumMoves = ['body_roll', 'arm_wave', 'turn', 'jump', 'shoulder_pop', 'punch', 'shimmy'];

    const moves = [];
    const numMoves = 10 + Math.floor(Math.random() * 3);
    const duration = 180; // Assume 3 minutes
    const interval = duration / numMoves;

    // Start easy
    moves.push({
        moveId: easyMoves[Math.floor(Math.random() * easyMoves.length)],
        beats: 8,
        startTime: 5
    });

    // Build routine
    for (let i = 1; i < numMoves; i++) {
        const progress = i / numMoves;
        // More medium moves in the middle, easier at start/end
        const useMedium = progress > 0.2 && progress < 0.8 && Math.random() > 0.4;
        const movePool = useMedium ? mediumMoves : easyMoves;

        moves.push({
            moveId: movePool[Math.floor(Math.random() * movePool.length)],
            beats: Math.random() > 0.5 ? 8 : 4,
            startTime: Math.round(5 + i * interval)
        });
    }

    return {
        songVibe: vibe,
        estimatedBPM: 100 + Math.floor(Math.random() * 40),
        moves
    };
}

// Build routine from choreography data
function buildRoutine(choreography) {
    return choreography.moves.map((move, index) => {
        const moveData = MOVE_CATALOG[move.moveId];
        if (!moveData) {
            console.warn(`Unknown move: ${move.moveId}, using step_touch`);
            return {
                ...MOVE_CATALOG['step_touch'],
                moveId: 'step_touch',
                beats: move.beats || 8,
                startTime: move.startTime,
                index: index + 1
            };
        }
        return {
            ...moveData,
            moveId: move.moveId,
            beats: move.beats || moveData.defaultBeats,
            startTime: move.startTime,
            index: index + 1
        };
    });
}

// Create YouTube player
function createPlayer(videoId) {
    return new Promise((resolve) => {
        if (player) {
            player.destroy();
        }

        player = new YT.Player('youtube-player', {
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                modestbranding: 1,
                rel: 0,
                showinfo: 0
            },
            events: {
                onReady: (event) => {
                    videoDuration = event.target.getDuration();
                    resolve(event.target);
                },
                onStateChange: onPlayerStateChange
            }
        });
    });
}

// Handle player state changes
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayButton();
        startUpdateLoop();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButton();
        stopUpdateLoop();
    } else if (event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        updatePlayButton();
        stopUpdateLoop();
        showScreen('complete');
    }
}

// Update play/pause button
function updatePlayButton() {
    const playIcon = elements.playPauseBtn.querySelector('.play-icon');
    const pauseIcon = elements.playPauseBtn.querySelector('.pause-icon');

    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

// Start update loop for progress and card sync
function startUpdateLoop() {
    stopUpdateLoop();
    updateInterval = setInterval(updateProgress, 100);
}

function stopUpdateLoop() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

// Update progress bar and sync cards
function updateProgress() {
    if (!player || !isPlaying) return;

    const currentTime = player.getCurrentTime();
    const progress = (currentTime / videoDuration) * 100;
    elements.progressFill.style.width = `${progress}%`;

    // Update time display
    elements.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(videoDuration)}`;

    // Update current move based on timestamp
    updateCurrentMove(currentTime);

    // Sync lyrics with current time
    syncLyrics(currentTime);
}

// Format time as M:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update current move card
function updateCurrentMove(currentTime) {
    // Find the current move based on timestamp
    let newMoveIndex = 0;
    for (let i = 0; i < currentRoutine.length; i++) {
        if (currentTime >= currentRoutine[i].startTime) {
            newMoveIndex = i;
        } else {
            break;
        }
    }

    if (newMoveIndex !== currentMoveIndex) {
        currentMoveIndex = newMoveIndex;
        displayCurrentMove();
        updateContextualMessage();
    }
}

// Display current and next move
function displayCurrentMove() {
    const current = currentRoutine[currentMoveIndex];
    const next = currentRoutine[currentMoveIndex + 1];

    // Update current card
    document.querySelector('.move-number').textContent = `Move ${current.index}`;
    document.querySelector('.difficulty').innerHTML = generateStars(current.difficulty);
    elements.currentPictogram.innerHTML = current.pictogram;
    elements.currentMoveName.textContent = current.name;
    elements.currentBodyPart.textContent = current.bodyPart;
    elements.currentBeats.textContent = `${current.beats} counts`;

    // Trigger animation
    const currentCard = document.getElementById('current-card');
    currentCard.style.animation = 'none';
    currentCard.offsetHeight; // Trigger reflow
    currentCard.style.animation = 'cardAppear 0.4s ease';

    // Update next card
    const nextCard = document.getElementById('next-card');
    if (next) {
        nextCard.classList.remove('hidden');
        elements.nextPictogram.innerHTML = next.pictogram;
        elements.nextMoveName.textContent = next.name;
    } else {
        nextCard.classList.add('hidden');
    }

    // Update move dots
    updateMoveDots();
}

// Update move progress dots
function updateMoveDots() {
    elements.moveDots.innerHTML = currentRoutine.map((move, index) => {
        let className = 'move-dot';
        if (index < currentMoveIndex) className += ' completed';
        if (index === currentMoveIndex) className += ' active';
        return `<div class="${className}"></div>`;
    }).join('');
}

// Update contextual message
function updateContextualMessage() {
    const progress = currentMoveIndex / currentRoutine.length;
    let category;

    if (currentMoveIndex === 0) {
        category = 'start';
    } else if (progress > 0.85) {
        category = 'finish';
    } else if (Math.random() > 0.6) {
        category = 'encourage';
    } else {
        category = 'transition';
    }

    elements.contextualMessage.textContent = getRandomMessage(category);
}

// Render move markers on progress bar
function renderMoveMarkers() {
    elements.moveMarkers.innerHTML = currentRoutine.map(move => {
        const position = (move.startTime / videoDuration) * 100;
        return `<div class="move-marker" style="left: ${position}%"></div>`;
    }).join('');
}

// Show a specific screen
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

// Show error message
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    setTimeout(() => {
        elements.errorMessage.classList.add('hidden');
    }, 5000);
}

// Main generation flow
async function handleGenerate(forceRegenerate = false) {
    const url = elements.youtubeUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();

    // Validate URL
    const videoId = extractVideoId(url);
    if (!videoId) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    // Check API key (needed for regeneration or new songs)
    if (!apiKey && !choreographyDB.has(videoId)) {
        showError('Please enter your Claude API key in Settings');
        elements.apiKeyContainer.classList.remove('hidden');
        return;
    }

    // Save API key to localStorage
    if (apiKey) {
        localStorage.setItem('claude_api_key', apiKey);
    }

    // Store current video ID
    currentVideoId = videoId;

    // Show loading screen
    showScreen('loading');
    elements.loadingText.textContent = 'Fetching song info...';

    try {
        // Check database for cached choreography (unless forcing regeneration)
        const cached = !forceRegenerate && choreographyDB.get(videoId);

        if (cached) {
            // Use cached data
            console.log('Using cached choreography for:', videoId);
            isFromCache = true;
            currentSongInfo = { title: cached.title, artist: cached.artist };
            currentChoreography = cached.choreography;

            elements.loadingText.textContent = 'Loading your saved routine...';

            // Display lyrics if cached
            if (cached.lyrics && cached.lyrics.segments) {
                displayLyrics(cached.lyrics);
            } else {
                // Transcribe lyrics in background
                fetchAndDisplayLyrics(videoId);
            }
        } else {
            // Fetch fresh data
            isFromCache = false;

            // Get video info
            currentSongInfo = await fetchVideoInfo(videoId);
            elements.loadingText.textContent = 'Creating your dance routine...';

            // Generate choreography
            try {
                currentChoreography = await generateChoreography(currentSongInfo, apiKey);
            } catch (error) {
                console.warn('API failed, using fallback:', error);
                currentChoreography = generateFallbackChoreography();
            }

            // Save to database
            choreographyDB.save(videoId, {
                title: currentSongInfo.title,
                artist: currentSongInfo.artist,
                choreography: currentChoreography
            });

            // Transcribe lyrics in background
            fetchAndDisplayLyrics(videoId);
        }

        // Build routine
        currentRoutine = buildRoutine(currentChoreography);

        // Update UI with song info
        elements.songTitle.textContent = currentSongInfo.title;
        elements.songArtist.textContent = currentSongInfo.artist;
        elements.songVibe.textContent = currentChoreography.songVibe.charAt(0).toUpperCase() + currentChoreography.songVibe.slice(1);

        // Show/hide saved badge
        if (isFromCache) {
            elements.savedBadge.classList.remove('hidden');
        } else {
            elements.savedBadge.classList.add('hidden');
        }

        // Set initial contextual message based on vibe
        if (currentChoreography.songVibe === 'energetic' || currentChoreography.songVibe === 'fun') {
            elements.contextualMessage.textContent = getRandomMessage('upbeat');
        } else {
            elements.contextualMessage.textContent = getRandomMessage('start');
        }

        elements.loadingText.textContent = 'Setting up video player...';

        // Wait for YouTube API
        if (!playerReady) {
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (playerReady) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
        }

        // Create player
        await createPlayer(videoId);

        // Adjust move timestamps if video is shorter/longer than expected
        const expectedDuration = 180;
        if (Math.abs(videoDuration - expectedDuration) > 30) {
            const ratio = videoDuration / expectedDuration;
            currentRoutine.forEach(move => {
                move.startTime = Math.min(move.startTime * ratio, videoDuration - 10);
            });
        }

        // Initialize display
        currentMoveIndex = 0;
        displayCurrentMove();
        renderMoveMarkers();
        elements.progressFill.style.width = '0%';
        elements.timeDisplay.textContent = `0:00 / ${formatTime(videoDuration)}`;

        // Show dance screen
        showScreen('dance');

    } catch (error) {
        console.error('Error:', error);
        showError(error.message || 'Something went wrong. Please try again.');
        showScreen('input');
    }
}

// Handle regenerate button click
async function handleRegenerate() {
    const apiKey = elements.apiKey.value.trim() || localStorage.getItem('claude_api_key');

    if (!apiKey) {
        showError('Please enter your Claude API key in Settings to regenerate');
        showScreen('input');
        elements.apiKeyContainer.classList.remove('hidden');
        return;
    }

    // Delete the cached version
    if (currentVideoId) {
        choreographyDB.delete(currentVideoId);
    }

    // Regenerate with force flag
    await handleGenerate(true);
}

// Current lyrics data for syncing
let currentLyricsData = null;
let currentLyricIndex = -1;

// Fetch and display lyrics using Whisper transcription
async function fetchAndDisplayLyrics(videoId) {
    // Show loading state
    elements.lyricsContent.innerHTML = '<p class="lyrics-placeholder">Transcribing audio with Whisper...</p>';

    try {
        const lyricsData = await LyricsService.fetch(videoId);

        if (lyricsData && lyricsData.segments) {
            // Store for syncing
            currentLyricsData = lyricsData;
            currentLyricIndex = -1;

            // Update database with lyrics data
            choreographyDB.updateLyrics(videoId, lyricsData);
            displayLyrics(lyricsData);
        } else {
            elements.lyricsContent.innerHTML = `
                <div class="lyrics-error">
                    <p>Could not transcribe audio.</p>
                    <p>Make sure the backend server is running.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error fetching lyrics:', error);

        // Check if it's a connection error
        if (error.message.includes('fetch') || error.message.includes('network')) {
            elements.lyricsContent.innerHTML = `
                <div class="lyrics-error">
                    <p>Backend server not running.</p>
                    <p>Start with: <code>python server.py</code></p>
                </div>
            `;
        } else {
            elements.lyricsContent.innerHTML = `
                <div class="lyrics-error">
                    <p>Transcription failed: ${error.message}</p>
                </div>
            `;
        }
    }
}

// Display lyrics in the panel
function displayLyrics(lyricsData) {
    currentLyricsData = lyricsData;
    currentLyricIndex = -1;

    const formattedLyrics = LyricsService.format(lyricsData);
    if (formattedLyrics) {
        elements.lyricsContent.innerHTML = formattedLyrics;
    }
}

// Sync lyrics highlight with current playback time
function syncLyrics(currentTime) {
    if (!currentLyricsData || !currentLyricsData.segments) return;

    const segments = currentLyricsData.segments;

    // Find the current segment
    let newIndex = -1;
    for (let i = 0; i < segments.length; i++) {
        if (currentTime >= segments[i].start && currentTime < segments[i].end) {
            newIndex = i;
            break;
        }
        // Also highlight if we're past this segment but before the next
        if (currentTime >= segments[i].start &&
            (i === segments.length - 1 || currentTime < segments[i + 1].start)) {
            newIndex = i;
        }
    }

    // Update highlight if changed
    if (newIndex !== currentLyricIndex) {
        currentLyricIndex = newIndex;

        // Remove all active classes
        const allLines = elements.lyricsContent.querySelectorAll('.lyrics-line');
        allLines.forEach(line => line.classList.remove('active'));

        // Add active class to current line
        if (newIndex >= 0) {
            const activeLine = elements.lyricsContent.querySelector(`[data-index="${newIndex}"]`);
            if (activeLine) {
                activeLine.classList.add('active');

                // Scroll into view
                activeLine.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }
}

// Toggle lyrics panel
function toggleLyrics() {
    elements.lyricsSection.classList.toggle('collapsed');
}

// Handle progress bar click
function handleProgressClick(event) {
    if (!player || !videoDuration) return;

    const rect = elements.progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * videoDuration;

    player.seekTo(seekTime, true);
    updateCurrentMove(seekTime);
}

// Handle speed button
function handleSpeedChange() {
    currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
    playbackSpeed = speeds[currentSpeedIndex];
    elements.speedBtn.textContent = `${playbackSpeed}x`;

    if (player) {
        player.setPlaybackRate(playbackSpeed);
    }
}

// Reset and go back
function handleBack() {
    if (player) {
        player.pauseVideo();
    }
    stopUpdateLoop();
    showScreen('input');
}

// Replay routine
function handleReplay() {
    if (player) {
        player.seekTo(0, true);
        player.playVideo();
    }
    currentMoveIndex = 0;
    displayCurrentMove();
    showScreen('dance');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize YouTube API
    initYouTubeAPI();

    // Load saved API key
    const savedApiKey = localStorage.getItem('claude_api_key');
    if (savedApiKey) {
        elements.apiKey.value = savedApiKey;
    }

    // Input screen events
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.youtubeUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleGenerate();
    });

    // API key toggle
    elements.toggleApiKey.addEventListener('click', () => {
        elements.apiKeyContainer.classList.toggle('hidden');
    });

    // Dance screen events
    elements.backBtn.addEventListener('click', handleBack);
    elements.regenerateBtn.addEventListener('click', handleRegenerate);

    elements.playPauseBtn.addEventListener('click', () => {
        if (!player) return;
        if (isPlaying) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });

    elements.progressBar.addEventListener('click', handleProgressClick);
    elements.speedBtn.addEventListener('click', handleSpeedChange);

    // Lyrics toggle
    elements.toggleLyricsBtn.addEventListener('click', toggleLyrics);

    // Complete screen events
    elements.replayBtn.addEventListener('click', handleReplay);
    elements.newSongBtn.addEventListener('click', () => {
        elements.youtubeUrl.value = '';
        showScreen('input');
    });

    // Handle page visibility for pausing
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && player && isPlaying) {
            player.pauseVideo();
        }
    });
});

// Export for debugging
window.debugDanceCard = {
    getRoutine: () => currentRoutine,
    getCurrentMove: () => currentRoutine[currentMoveIndex],
    getPlayer: () => player,
    getVideoId: () => currentVideoId,
    getSongInfo: () => currentSongInfo,
    isFromCache: () => isFromCache
};
