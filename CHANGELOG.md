# Changelog

All notable changes to the Dance Card Generator project.

## [Unreleased] - 2026-01-19

### Added

#### Lyrics & Choreography Separation (ARCHITECTURE)
- **NEW: Separate database tables** for lyrics and choreography
  - `lyrics` table: ONE per song, stores segments and structure
  - `routines` table: MANY per song, supports multiple dance versions
- **Lyrics are PRESERVED** when regenerating choreography
  - Carefully edited timestamps are never lost
  - Regenerating creates a new routine version, not a replacement
- **Multiple choreography versions per song**
  - Each version has a name (e.g., "Original", "Easy Version", "Party Mix")
  - One version marked as default
  - Switch between versions, set new default, delete old versions
- **New admin UI** with two-column layout:
  - Lyrics section (cyan): Shows "PRESERVED" badge, Open Editor, Quick Edit
  - Choreographies section (pink): Shows "REGENERABLE" badge, version list, + New Version
- **New API endpoints**:
  - `GET /api/songs/{id}/lyrics` - get lyrics only
  - `PUT /api/admin/song/{id}/lyrics` - update lyrics
  - `GET /api/songs/{id}/routines` - get all choreography versions
  - `POST /api/admin/song/{id}/routines` - create new version
  - `PUT /api/admin/routines/{id}` - update specific routine
  - `DELETE /api/admin/routines/{id}` - delete routine
  - `POST /api/admin/routines/{id}/default` - set as default
  - `POST /api/admin/song/{id}/regenerate` - generate new choreography version
- **Automatic data migration** from old schema to new

#### Manual Lyrics Input (HIGH PRIORITY)
- New lyrics source selector in admin: "Auto-detect with Whisper" vs "Paste Lyrics Manually"
- When using manual mode, system uses Whisper for timestamp detection only
- **NEW: Text similarity-based alignment** - matches pasted lyrics to Whisper segments by word overlap
- Each lyric line matched to the Whisper segment with most similar text
- Logs show match quality: `"Line 1: 'I can buy...' → matched to [5.2s] (sim=0.85)"`
- Supports multi-language songs and handles Whisper failures
- Tip displayed to copy lyrics from Musixmatch, Genius, or AZLyrics

#### Improved Song Structure Detection
- **NEW: Line-occurrence based algorithm** - lines appearing 2+ times = CHORUS
- Now detects: INTRO, VERSE 1/2/3, PRE-CHORUS, CHORUS, BRIDGE, OUTRO
- Consecutive same-type segments grouped into sections
- Short sections (1-3 lines) before chorus → PRE-CHORUS
- Unique sections after 60% of song → BRIDGE
- Labels show "CHORUS (repeat)" for subsequent chorus occurrences
- Color-coded section types in admin preview:
  - INTRO: Cyan
  - VERSE: Gray
  - PRE-CHORUS: Purple
  - CHORUS: Yellow
  - BRIDGE: Orange
  - OUTRO: Green

#### Section Indicator in Player
- **NEW: Real-time section display** above lyrics during playback
- Shows current section with icon: 🎤 CHORUS, 📝 VERSE 2, ⚡ PRE-CHORUS, 🌉 BRIDGE
- Color-coded indicator matches section type
- Displays "🎵 INSTRUMENTAL" during non-lyric sections

#### Instrumental Section Handling
- Player shows "🎵 Instrumental..." during gaps > 5 seconds
- Choreography generator explicitly skips instrumental sections
- Detects: instrumental intros, instrumental breaks, instrumental outros

#### Repeated Choreography for Repeated Sections
- When a section repeats (same lyrics), choreography uses same moves
- Makes dances easier to learn - same chorus = same moves each time
- Repetition info passed to Claude for consistent move generation
- **NEW: Detailed logging** shows which sections reuse moves

#### View Published Songs in Admin
- New View button in library tab
- Modal displays: thumbnail, title, artist, duration, BPM, status
- Full move sequence with hover tooltips
- Direct "Play Song" link to test choreography

#### Manual Timestamp Editor (Quick)
- **NEW: Edit timestamps** directly in admin song detail modal
- Editable timestamp input for each lyric line (M:SS.s format)
- Play button per line - opens player at that timestamp
- Bulk offset field - shift all timestamps by N seconds
- Save/Reset buttons with API persistence
- `/api/admin/song/<video_id>/timestamps` endpoint for saving

#### Full Lyrics Timeline Editor (Subtitle Edit Style)
- **NEW: Professional subtitle-style editor** at `/editor?id=VIDEO_ID`
- **Split-pane layout** inspired by Subtitle Edit:
  - **Top section (60%)**: Lyrics table on left, Video player on right
  - **Bottom section (40%)**: Waveform timeline with subtitle blocks
- **Lyrics table** with columns:
  - Line number (#)
  - Start time (M:SS.s format)
  - End time (M:SS.s format)
  - Duration
  - Text (truncated with tooltip for full text)
  - Click to select, double-click to play
- **Edit panel** below table for selected line:
  - Editable text input
  - Start time input (changes preserve duration)
  - Duration input (adjusts end time)
  - Prev/Next navigation buttons
  - Split, Delete, Insert buttons
- **Video panel** with:
  - Embedded YouTube player
  - Large current time display (2rem monospace)
  - Seek buttons: -5s, -1s, +1s, +5s
  - Play/Pause button
- **Waveform timeline** with:
  - Time ruler with tick marks at intervals
  - Simulated waveform visualization bars
  - Draggable subtitle blocks per lyric line
  - Resize handles on left/right edges of blocks
  - Red playhead synced to video position
- **Toolbar actions**:
  - Zoom in/out controls with percentage label
  - "Go to Playhead" button
  - "Play Selection" button
  - **Set Start** - sets selected line's start to playhead position
  - **Set End** - sets selected line's end to playhead position
  - "+ Insert Here" - adds new line at playhead
- **Keyboard shortcuts**:
  - `Space`: Play/Pause
  - `← →`: Seek 1s (0.1s with Shift)
  - `↑ ↓`: Navigate lines (prev/next)
  - `S`: Set start to playhead
  - `E`: Set end to playhead
  - `I`: Insert new line at playhead
  - `Enter`: Play selected line
  - `Delete/Backspace`: Delete selected line
  - `Ctrl+S / Cmd+S`: Save changes
  - `Escape`: Exit input fields
- **Save state tracking**:
  - Status indicator shows "All changes saved" (green) or "Unsaved changes" (pink)
  - Browser warns before closing with unsaved changes
- "Full Editor" button in admin song detail modal

#### BPM Detection with librosa
- **NEW: Real BPM detection** using librosa audio analysis
- Analyzes first 60 seconds of audio for tempo
- Handles numpy array return values from different librosa versions
- Falls back to 120 BPM if detection fails
- BPM displayed in song cards and detail modal

#### Audio Caching
- Audio files cached by video_id in `.lyrics_cache/`
- Terminal shows "Using cached audio" vs "Audio downloaded"
- Re-processing same URL reuses cached audio

#### URL Parameter Support
- Direct song links: `/?id=VIDEO_ID`
- "Play Song" button in admin opens song directly

#### Debug Logging
- **NEW: Detailed structure detection logging:**
  ```
  [STRUCTURE] Analyzing 45 lyric segments...
  [STRUCTURE] Found 8 repeated lines (likely chorus)
  [STRUCTURE] Detected sections:
    - VERSE 1: 5s - 28s (6 lines)
    - CHORUS: 28s - 55s (8 lines)
    - VERSE 2: 55s - 78s (6 lines)
    - CHORUS (repeat): 78s - 105s (8 lines) [REPEATED - same moves as CHORUS at 28s]
  ```
- **NEW: Lyrics alignment logging:**
  ```
  [ALIGN] Aligning 32 manual lines to 28 Whisper segments
  [ALIGN]   Line 1: 'I can buy myself...' → matched to [5.2s] (sim=0.85)
  [ALIGN] Result: 28/32 lines matched by similarity
  ```

### Fixed

#### Play Song Button in Admin
- Changed from `/play.html?id=...` to `/?id=...`
- Now correctly opens song in player mode

#### Hover Tooltips in View Modal
- Moved tooltip element to global scope (outside tabs)
- Tooltips now work in preview section AND view modal

#### Whisper Noise Detection
- Added more noise markers: 'song lyrics', 'lyrics', 'singing'
- Filters out repeated "music" patterns

### Changed

#### Choreography Generation Prompt
- Now includes lyrics timing for instrumental detection
- Includes repeated section mapping
- Explicitly instructs to skip instrumental sections
- Instructs to reuse moves for repeated sections

#### Admin UI
- Added lyrics mode selector with radio buttons
- Manual lyrics textarea with placeholder example
- Processing step text changes based on mode ("Aligning lyrics to audio...")

#### Player Lyrics Display
- Shows "🎵 Instrumental..." during instrumental sections
- Styled with italic, dimmed text
- Detects intro, outro, and mid-song breaks

## [1.0.0] - 2026-01-19 (Initial Commit)

### Added
- Flask backend with SQLite database
- YouTube video info fetching
- Whisper audio transcription
- Claude API choreography generation
- Admin interface for song management
- Public library with difficulty filters
- Song request system
- YouTube player integration
- Beat counter synchronized to BPM
- Move catalog with 17 dance moves
- Responsive design for mobile
