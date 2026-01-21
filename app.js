// Dance Card Generator - Main Application (Library-based)

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
let currentSongData = null;
let currentLyricsSegments = null;
let currentLyricIndex = -1;
let currentSongSections = null;
let currentSectionIndex = -1;

// Beat counter state
let beatCounterInterval = null;
let currentBeat = 1;
let estimatedBPM = 120;

// Library state
let songLibrary = [];
let currentFilter = 'all';

// API base URL
const API_BASE = window.location.origin;

// DOM Elements
const screens = {
    library: document.getElementById('library-screen'),
    loading: document.getElementById('loading-screen'),
    dance: document.getElementById('dance-screen'),
    complete: document.getElementById('complete-screen')
};

const elements = {
    // Library elements
    songLibrary: document.getElementById('song-library'),
    emptyLibrary: document.getElementById('empty-library'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    requestSongBtn: document.getElementById('request-song-btn'),

    // Request modal elements
    requestModal: document.getElementById('request-modal'),
    closeRequestModal: document.getElementById('close-request-modal'),
    requestForm: document.getElementById('request-form'),
    requestUrl: document.getElementById('request-url'),
    requestNote: document.getElementById('request-note'),
    requestSuccess: document.getElementById('request-success'),

    // Loading elements
    loadingText: document.getElementById('loading-text'),

    // Dance screen elements
    backBtn: document.getElementById('back-btn'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    songVibe: document.getElementById('song-vibe'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    moveMarkers: document.getElementById('move-markers'),
    timeDisplay: document.getElementById('time-display'),
    speedBtn: document.getElementById('speed-btn'),
    contextualMessage: document.getElementById('contextual-message'),

    // Card elements
    currentPictogram: document.getElementById('current-pictogram'),
    currentMoveName: document.getElementById('current-move-name'),
    currentBodyPart: document.getElementById('current-body-part'),
    currentBeats: document.getElementById('current-beats'),
    nextPictogram: document.getElementById('next-pictogram'),
    nextMoveName: document.getElementById('next-move-name'),
    moveDots: document.getElementById('move-dots'),

    // Beat counter elements
    beatDots: document.getElementById('beat-dots'),
    beatNumber: document.getElementById('beat-number'),

    // Lyrics display elements
    currentLyric: document.getElementById('current-lyric'),
    nextLyric: document.getElementById('next-lyric'),

    // Section indicator elements
    sectionIndicator: document.getElementById('section-indicator'),
    sectionIcon: document.getElementById('section-icon'),
    sectionName: document.getElementById('section-name'),

    // Complete screen elements
    replayBtn: document.getElementById('replay-btn'),
    newSongBtn: document.getElementById('new-song-btn'),
    totalMoves: document.getElementById('total-moves'),
    songDuration: document.getElementById('song-duration'),
    completeSongInfo: document.getElementById('complete-song-info')
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

// ============ LIBRARY FUNCTIONS ============

// Load song library from server
async function loadLibrary() {
    try {
        const response = await fetch(`${API_BASE}/api/songs`);
        if (!response.ok) throw new Error('Failed to load library');

        songLibrary = await response.json();
        renderLibrary();
    } catch (error) {
        console.error('Error loading library:', error);
        elements.songLibrary.innerHTML = `
            <div class="library-error">
                <p>Could not load songs.</p>
                <p class="hint">Make sure the server is running: <code>python server.py</code></p>
            </div>
        `;
    }
}

// Render song library grid
function renderLibrary() {
    const filtered = currentFilter === 'all'
        ? songLibrary
        : songLibrary.filter(song => song.difficulty === parseInt(currentFilter));

    if (filtered.length === 0) {
        elements.songLibrary.classList.add('hidden');
        elements.emptyLibrary.classList.remove('hidden');
        return;
    }

    elements.songLibrary.classList.remove('hidden');
    elements.emptyLibrary.classList.add('hidden');

    elements.songLibrary.innerHTML = filtered.map(song => `
        <div class="song-card" data-video-id="${song.video_id}">
            <div class="song-thumbnail">
                ${song.thumbnail_url
                    ? `<img src="${song.thumbnail_url}" alt="${song.title}">`
                    : `<div class="placeholder-thumbnail"></div>`
                }
                <div class="difficulty-badge difficulty-${song.difficulty}">
                    ${getDifficultyLabel(song.difficulty)}
                </div>
            </div>
            <div class="song-card-info">
                <h3 class="song-card-title">${escapeHtml(song.title)}</h3>
                <p class="song-card-artist">${escapeHtml(song.artist)}</p>
                ${song.genre ? `<span class="song-card-genre">${escapeHtml(song.genre)}</span>` : ''}
            </div>
        </div>
    `).join('');

    // Add click handlers to song cards
    elements.songLibrary.querySelectorAll('.song-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.dataset.videoId;
            loadSong(videoId);
        });
    });
}

// Get difficulty label
function getDifficultyLabel(difficulty) {
    const labels = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
    return labels[difficulty] || 'Medium';
}

// Filter library
function filterLibrary(filter) {
    currentFilter = filter;

    // Update active button
    elements.filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    renderLibrary();
}

// ============ SONG REQUEST FUNCTIONS ============

// Show request modal
function showRequestModal() {
    elements.requestModal.classList.remove('hidden');
    elements.requestForm.classList.remove('hidden');
    elements.requestSuccess.classList.add('hidden');
    elements.requestUrl.value = '';
    elements.requestNote.value = '';
}

// Hide request modal
function hideRequestModal() {
    elements.requestModal.classList.add('hidden');
}

// Submit song request
async function submitRequest(event) {
    event.preventDefault();

    const url = elements.requestUrl.value.trim();
    const note = elements.requestNote.value.trim();

    if (!url) return;

    try {
        const response = await fetch(`${API_BASE}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtube_url: url, user_note: note })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        // Show success message
        elements.requestForm.classList.add('hidden');
        elements.requestSuccess.classList.remove('hidden');

        // Close modal after delay
        setTimeout(hideRequestModal, 2000);
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('Failed to submit request: ' + error.message);
    }
}

// ============ SONG LOADING FUNCTIONS ============

// Load a song and its routine
async function loadSong(videoId) {
    showScreen('loading');
    elements.loadingText.textContent = 'Loading your dance...';

    try {
        const response = await fetch(`${API_BASE}/api/songs/${videoId}`);
        if (!response.ok) throw new Error('Song not found');

        currentSongData = await response.json();
        currentVideoId = videoId;

        // Parse lyrics segments (now from separate lyrics table)
        if (currentSongData.lyrics) {
            currentLyricsSegments = currentSongData.lyrics.segments || null;
        } else {
            currentLyricsSegments = null;
        }

        // Parse song sections for section indicator (now at top level or in structure)
        if (currentSongData.structure?.sections) {
            currentSongSections = currentSongData.structure.sections;
        } else if (currentSongData.routine?.structure?.sections) {
            // Fallback for old data format
            currentSongSections = currentSongData.routine.structure.sections;
        } else {
            currentSongSections = null;
        }
        currentSectionIndex = -1;

        // Build routine from stored choreography
        if (currentSongData.routine && currentSongData.routine.moves) {
            currentRoutine = buildRoutine(currentSongData.routine.moves);
            // BPM from song metadata (preferred) or fallback to old locations
            estimatedBPM = currentSongData.song?.bpm || currentSongData.structure?.estimatedBPM || currentSongData.routine.structure?.estimatedBPM || 120;
        } else {
            throw new Error('No choreography available for this song');
        }

        // Update UI with song info
        elements.songTitle.textContent = currentSongData.song.title;
        elements.songArtist.textContent = currentSongData.song.artist;

        // Set vibe badge
        const vibe = currentSongData.routine.structure?.songVibe || 'fun';
        elements.songVibe.textContent = vibe.charAt(0).toUpperCase() + vibe.slice(1);

        // Set initial contextual message
        if (vibe === 'energetic' || vibe === 'fun') {
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

        // Adjust move timestamps if needed
        const expectedDuration = currentSongData.song.duration || 180;
        if (Math.abs(videoDuration - expectedDuration) > 30) {
            const ratio = videoDuration / expectedDuration;
            currentRoutine.forEach(move => {
                move.startTime = Math.min(move.startTime * ratio, videoDuration - 10);
            });
        }

        // Initialize display
        currentMoveIndex = 0;
        currentLyricIndex = -1;
        displayCurrentMove();
        renderMoveMarkers();
        initBeatCounter();
        elements.progressFill.style.width = '0%';
        elements.timeDisplay.textContent = `0:00 / ${formatTime(videoDuration)}`;

        // Show dance screen
        showScreen('dance');

    } catch (error) {
        console.error('Error loading song:', error);
        alert('Failed to load song: ' + error.message);
        showScreen('library');
    }
}

// Build routine from choreography data
function buildRoutine(moves) {
    return moves.map((move, index) => {
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

// ============ YOUTUBE PLAYER FUNCTIONS ============

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
        startBeatCounter();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButton();
        stopUpdateLoop();
        stopBeatCounter();
    } else if (event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        updatePlayButton();
        stopUpdateLoop();
        stopBeatCounter();
        showCompleteScreen();
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

// ============ UPDATE LOOP FUNCTIONS ============

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

// Update progress bar and sync cards/lyrics
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

    // Sync section indicator
    syncSection(currentTime);
}

// Format time as M:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============ MOVE DISPLAY FUNCTIONS ============

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
        resetBeatCounter();
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

    // Update beat dots for this move
    updateBeatDots(current.beats);

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

// ============ BEAT COUNTER FUNCTIONS ============

// Initialize beat counter
function initBeatCounter() {
    const current = currentRoutine[0];
    if (current) {
        updateBeatDots(current.beats);
    }
    currentBeat = 1;
    elements.beatNumber.textContent = '1';
}

// Update beat dots for current move
function updateBeatDots(beats) {
    elements.beatDots.innerHTML = Array(beats).fill(0).map((_, i) =>
        `<div class="beat-dot ${i === 0 ? 'active' : ''}"></div>`
    ).join('');
}

// Start beat counter
function startBeatCounter() {
    stopBeatCounter();
    const beatInterval = (60 / estimatedBPM) * 1000; // ms per beat

    beatCounterInterval = setInterval(() => {
        const current = currentRoutine[currentMoveIndex];
        if (!current) return;

        currentBeat = currentBeat >= current.beats ? 1 : currentBeat + 1;
        elements.beatNumber.textContent = currentBeat.toString();

        // Update beat dots
        const dots = elements.beatDots.querySelectorAll('.beat-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i < currentBeat);
        });
    }, beatInterval);
}

// Stop beat counter
function stopBeatCounter() {
    if (beatCounterInterval) {
        clearInterval(beatCounterInterval);
        beatCounterInterval = null;
    }
}

// Reset beat counter when move changes
function resetBeatCounter() {
    currentBeat = 1;
    elements.beatNumber.textContent = '1';

    const current = currentRoutine[currentMoveIndex];
    if (current) {
        updateBeatDots(current.beats);
    }

    // Restart counter if playing
    if (isPlaying) {
        startBeatCounter();
    }
}

// ============ LYRICS SYNC FUNCTIONS ============

// Sync lyrics display with current playback time
function syncLyrics(currentTime) {
    if (!currentLyricsSegments || currentLyricsSegments.length === 0) {
        elements.currentLyric.textContent = '🎵 Instrumental...';
        elements.currentLyric.classList.add('instrumental');
        elements.nextLyric.textContent = '';
        return;
    }

    // Find the current and next segment
    let currentSegment = null;
    let nextSegment = null;
    let isInstrumental = false;
    let gapDuration = 0;

    const firstLyricTime = currentLyricsSegments[0].start;
    const lastLyricTime = currentLyricsSegments[currentLyricsSegments.length - 1].end;

    // Before any lyrics start (intro)
    if (currentTime < firstLyricTime) {
        isInstrumental = true;
        gapDuration = firstLyricTime - currentTime;
        nextSegment = currentLyricsSegments[0];
    }
    // After all lyrics end (outro)
    else if (currentTime > lastLyricTime) {
        isInstrumental = true;
        gapDuration = videoDuration - lastLyricTime;
    }
    else {
        // Find current segment or gap
        for (let i = 0; i < currentLyricsSegments.length; i++) {
            const segment = currentLyricsSegments[i];

            if (currentTime >= segment.start && currentTime < segment.end) {
                currentSegment = segment;
                nextSegment = currentLyricsSegments[i + 1] || null;
                break;
            }

            // Check if we're in a gap between segments
            if (i < currentLyricsSegments.length - 1) {
                const nextSeg = currentLyricsSegments[i + 1];
                if (currentTime >= segment.end && currentTime < nextSeg.start) {
                    gapDuration = nextSeg.start - segment.end;
                    // Only show instrumental for gaps > 5 seconds
                    if (gapDuration > 5) {
                        isInstrumental = true;
                    }
                    nextSegment = nextSeg;
                    break;
                }
            }
        }
    }

    // Update display
    if (isInstrumental && gapDuration > 5) {
        elements.currentLyric.textContent = '🎵 Instrumental...';
        elements.currentLyric.classList.add('instrumental');
        elements.currentLyric.classList.remove('active');
    } else if (currentSegment) {
        elements.currentLyric.textContent = currentSegment.text;
        elements.currentLyric.classList.add('active');
        elements.currentLyric.classList.remove('instrumental');
    } else {
        elements.currentLyric.textContent = '';
        elements.currentLyric.classList.remove('active', 'instrumental');
    }

    if (nextSegment) {
        elements.nextLyric.textContent = nextSegment.text;
    } else {
        elements.nextLyric.textContent = '';
    }
}

// ============ SECTION INDICATOR ============

// Get icon for section type
function getSectionIcon(sectionType) {
    const icons = {
        'intro': '🎬',
        'verse': '📝',
        'pre-chorus': '⚡',
        'chorus': '🎤',
        'bridge': '🌉',
        'outro': '🎬',
        'instrumental': '🎵'
    };
    return icons[sectionType] || '🎵';
}

// Sync section indicator with current playback time
function syncSection(currentTime) {
    if (!elements.sectionIndicator) return;

    // Check if we're in an instrumental section (no lyrics)
    let isInstrumental = false;

    if (currentLyricsSegments && currentLyricsSegments.length > 0) {
        const firstLyric = currentLyricsSegments[0].start;
        const lastLyric = currentLyricsSegments[currentLyricsSegments.length - 1].end;

        if (currentTime < firstLyric - 2 || currentTime > lastLyric + 2) {
            isInstrumental = true;
        }
    }

    // If we have song sections, find the current one
    if (currentSongSections && currentSongSections.length > 0) {
        let newSectionIndex = -1;

        for (let i = 0; i < currentSongSections.length; i++) {
            const section = currentSongSections[i];
            if (currentTime >= section.start && currentTime < section.end) {
                newSectionIndex = i;
                break;
            }
        }

        // Update display if section changed
        if (newSectionIndex !== currentSectionIndex) {
            currentSectionIndex = newSectionIndex;

            if (newSectionIndex >= 0) {
                const section = currentSongSections[newSectionIndex];
                const sectionType = section.type || 'verse';
                const sectionLabel = section.label || sectionType.toUpperCase();

                elements.sectionIcon.textContent = getSectionIcon(sectionType);
                elements.sectionName.textContent = sectionLabel;

                // Update indicator styling
                elements.sectionIndicator.className = 'section-indicator ' + sectionType;
            } else if (isInstrumental) {
                elements.sectionIcon.textContent = '🎵';
                elements.sectionName.textContent = 'INSTRUMENTAL';
                elements.sectionIndicator.className = 'section-indicator instrumental';
            }
        }
    } else if (isInstrumental) {
        // No sections data but instrumental
        elements.sectionIcon.textContent = '🎵';
        elements.sectionName.textContent = 'INSTRUMENTAL';
        elements.sectionIndicator.className = 'section-indicator instrumental';
    } else {
        // No sections data, hide or show generic
        elements.sectionIndicator.className = 'section-indicator';
        elements.sectionIcon.textContent = '🎵';
        elements.sectionName.textContent = '';
    }
}

// ============ SCREEN NAVIGATION ============

// Show a specific screen
function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

// Show completion screen
function showCompleteScreen() {
    // Update stats
    elements.totalMoves.textContent = currentRoutine.length.toString();
    elements.songDuration.textContent = formatTime(videoDuration);
    elements.completeSongInfo.textContent = `You completed "${currentSongData.song.title}"!`;

    showScreen('complete');
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
    syncLyrics(seekTime);
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

// Reset and go back to library
function handleBack() {
    if (player) {
        player.pauseVideo();
    }
    stopUpdateLoop();
    stopBeatCounter();
    showScreen('library');
}

// Replay routine
function handleReplay() {
    if (player) {
        player.seekTo(0, true);
        player.playVideo();
    }
    currentMoveIndex = 0;
    currentLyricIndex = -1;
    displayCurrentMove();
    resetBeatCounter();
    showScreen('dance');
}

// ============ UTILITY FUNCTIONS ============

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ EVENT LISTENERS ============

document.addEventListener('DOMContentLoaded', () => {
    // Initialize YouTube API
    initYouTubeAPI();

    // Load song library
    loadLibrary();

    // Check for direct song link via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const directVideoId = urlParams.get('id');
    if (directVideoId) {
        // Wait a moment for library to load, then load the song
        setTimeout(() => loadSong(directVideoId), 500);
    }

    // Filter button events
    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterLibrary(btn.dataset.filter);
        });
    });

    // Request song modal events
    elements.requestSongBtn.addEventListener('click', showRequestModal);
    elements.closeRequestModal.addEventListener('click', hideRequestModal);
    elements.requestModal.addEventListener('click', (e) => {
        if (e.target === elements.requestModal) hideRequestModal();
    });
    elements.requestForm.addEventListener('submit', submitRequest);

    // Dance screen events
    elements.backBtn.addEventListener('click', handleBack);

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

    // Complete screen events
    elements.replayBtn.addEventListener('click', handleReplay);
    elements.newSongBtn.addEventListener('click', () => {
        showScreen('library');
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
    getSongData: () => currentSongData,
    getLibrary: () => songLibrary,
    getBPM: () => estimatedBPM
};
