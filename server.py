#!/usr/bin/env python3
"""
Dance Card Generator - Backend Server

Handles:
- Public API: Song library, play songs, submit requests
- Admin API: Process songs, manage library, review requests
- Whisper transcription and lyrics analysis
- Choreography generation with Claude API
"""

import os
import json
import re
import subprocess
import tempfile
import socket
from pathlib import Path
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

import db

app = Flask(__name__, static_folder='.')
CORS(app)

# ============ CONFIGURATION ============

# Admin password from environment variable
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'dance123')

# Whisper model (small for good quality)
WHISPER_MODEL = os.environ.get('WHISPER_MODEL', 'small')

# Cache directory for audio files
CACHE_DIR = Path(__file__).parent / '.lyrics_cache'
CACHE_DIR.mkdir(exist_ok=True)

# Global whisper model (lazy loaded)
_whisper_model = None


# ============ UTILITIES ============

def is_port_available(port: int) -> bool:
    """Check if a port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('', port))
            return True
        except OSError:
            return False


def require_admin(f):
    """Decorator to require admin authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('X-Admin-Password')
        if auth != ADMIN_PASSWORD:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from URL."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)',
        r'^([a-zA-Z0-9_-]{11})$'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_whisper_model():
    """Lazy load the Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        import whisper
        print(f"Loading Whisper model: {WHISPER_MODEL}")
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        print("Whisper model loaded!")
    return _whisper_model


# ============ YOUTUBE HELPERS ============

def get_youtube_info(video_id: str) -> dict:
    """Fetch video info using YouTube oEmbed API."""
    import urllib.request
    import urllib.error

    url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json'
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())

        title = data.get('title', 'Unknown')
        artist = data.get('author_name', 'Unknown Artist')

        # Parse "Artist - Title" format
        if ' - ' in title:
            parts = title.split(' - ', 1)
            artist = parts[0].strip()
            title = re.sub(r'\s*[\(\[].*[\)\]]', '', parts[1]).strip()

        # Clean up title
        title = re.sub(r'\s*[\(\[](?:official|lyric|music|video|audio|hd|4k).*[\)\]]', '', title, flags=re.I).strip()

        return {
            'title': title,
            'artist': artist,
            'thumbnail_url': data.get('thumbnail_url', ''),
            'full_title': data.get('title', '')
        }
    except Exception as e:
        print(f"Error fetching video info: {e}")
        return {'title': 'Unknown', 'artist': 'Unknown', 'thumbnail_url': ''}


def download_audio(video_id: str) -> str:
    """Download audio from YouTube using yt-dlp."""
    output_path = CACHE_DIR / f"{video_id}.%(ext)s"
    final_path = CACHE_DIR / f"{video_id}.mp3"

    # Return cached if exists
    if final_path.exists():
        return str(final_path)

    cmd = [
        'yt-dlp',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '-o', str(output_path),
        '--no-playlist',
        '--quiet',
        f'https://www.youtube.com/watch?v={video_id}'
    ]

    subprocess.run(cmd, check=True)

    # Find output file
    for ext in ['mp3', 'webm', 'm4a', 'opus']:
        path = CACHE_DIR / f"{video_id}.{ext}"
        if path.exists():
            return str(path)

    raise FileNotFoundError(f"Could not find downloaded audio for {video_id}")


# ============ WHISPER TRANSCRIPTION ============

def is_noise_segment(text: str) -> bool:
    """Check if segment is noise/music marker, not lyrics."""
    text = text.strip().lower()
    noise = ['music', 'music playing', '[music]', '(music)', 'instrumental',
             '[instrumental]', '♪', '♫', '...', '', 'applause', 'silence',
             'song lyrics', 'lyrics', 'singing', '[singing]', '(singing)']
    if text in noise:
        return True
    if text.replace('music', '').replace(' ', '').replace(',', '') == '':
        return True
    if len(text) < 2:
        return True
    # Check for repeated "music" pattern
    if text.count('music') > 1:
        return True
    return False


def text_similarity(text1: str, text2: str) -> float:
    """Calculate word-based similarity between two texts (0.0 to 1.0)."""
    # Normalize texts
    words1 = set(normalize_text_for_comparison(text1).split())
    words2 = set(normalize_text_for_comparison(text2).split())

    if not words1 or not words2:
        return 0.0

    # Jaccard similarity
    intersection = len(words1 & words2)
    union = len(words1 | words2)

    return intersection / union if union > 0 else 0.0


def align_manual_lyrics(manual_lyrics: str, whisper_segments: list, duration: int) -> list:
    """
    Align manually pasted lyrics to Whisper timestamps using text similarity.
    Uses the correct pasted text but Whisper's detected timestamps.
    """
    # Split manual lyrics into lines
    lines = [line.strip() for line in manual_lyrics.strip().split('\n') if line.strip()]

    if not lines:
        return []

    print(f"[ALIGN] Aligning {len(lines)} manual lines to {len(whisper_segments)} Whisper segments")

    # If we have Whisper segments, use text similarity to match timestamps
    if whisper_segments and len(whisper_segments) > 0:
        segments = []
        used_whisper_indices = set()

        for i, line in enumerate(lines):
            best_match_idx = -1
            best_similarity = 0.0

            # Find the best matching Whisper segment (that hasn't been used yet)
            # Only search within a reasonable time window based on line position
            expected_position = i / len(lines)  # 0.0 to 1.0

            for j, wseg in enumerate(whisper_segments):
                if j in used_whisper_indices:
                    continue

                # Calculate position of this Whisper segment
                whisper_position = j / len(whisper_segments)

                # Penalize matches that are too far from expected position
                position_penalty = abs(whisper_position - expected_position)
                if position_penalty > 0.3:  # Allow 30% variance
                    continue

                similarity = text_similarity(line, wseg['text'])

                # Boost similarity for segments near expected position
                adjusted_similarity = similarity * (1 - position_penalty * 0.5)

                if adjusted_similarity > best_similarity:
                    best_similarity = adjusted_similarity
                    best_match_idx = j

            if best_match_idx >= 0 and best_similarity > 0.1:
                # Good match found - use Whisper's timestamp
                wseg = whisper_segments[best_match_idx]
                used_whisper_indices.add(best_match_idx)
                segments.append({
                    'start': wseg['start'],
                    'end': wseg['end'],
                    'text': line,  # Use the correct pasted text
                    'matched': True,
                    'similarity': round(best_similarity, 2)
                })
                print(f"[ALIGN]   Line {i+1}: '{line[:30]}...' → matched to [{wseg['start']:.1f}s] (sim={best_similarity:.2f})")
            else:
                # No good match - interpolate timestamp
                if segments:
                    # Use time after last segment
                    last_end = segments[-1]['end']
                    avg_duration = 3.0  # Assume 3 seconds per line
                    start = last_end + 0.5
                else:
                    # First line with no match - use first Whisper time or default
                    start = whisper_segments[0]['start'] if whisper_segments else 5.0
                    avg_duration = 3.0

                segments.append({
                    'start': round(start, 2),
                    'end': round(start + avg_duration, 2),
                    'text': line,
                    'matched': False,
                    'similarity': 0
                })
                print(f"[ALIGN]   Line {i+1}: '{line[:30]}...' → interpolated to [{start:.1f}s] (no match)")

        # Ensure segments are in chronological order and don't overlap
        segments.sort(key=lambda x: x['start'])

        # Fix any overlapping segments
        for i in range(1, len(segments)):
            if segments[i]['start'] < segments[i-1]['end']:
                segments[i]['start'] = segments[i-1]['end'] + 0.1
                if segments[i]['end'] <= segments[i]['start']:
                    segments[i]['end'] = segments[i]['start'] + 2.0

        matched_count = sum(1 for s in segments if s.get('matched', False))
        print(f"[ALIGN] Result: {matched_count}/{len(segments)} lines matched by similarity")

        return segments
    else:
        # No Whisper data, distribute evenly across song duration
        print(f"[ALIGN] No Whisper segments - distributing evenly")
        start_time = 10
        end_time = max(duration - 20, start_time + 30)
        total_time = end_time - start_time
        time_per_line = total_time / len(lines) if len(lines) > 0 else 5

        segments = []
        for i, line in enumerate(lines):
            start = start_time + (i * time_per_line)
            end = start + time_per_line - 0.5
            segments.append({
                'start': round(start, 2),
                'end': round(end, 2),
                'text': line,
                'matched': False
            })
        return segments


def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio using Whisper."""
    model = get_whisper_model()

    result = model.transcribe(
        audio_path,
        word_timestamps=True,
        verbose=False,
        initial_prompt="Song lyrics: ",
        condition_on_previous_text=True,
        temperature=0.0,
    )

    segments = []
    for seg in result.get('segments', []):
        text = seg['text'].strip()
        if not is_noise_segment(text):
            segments.append({
                'start': round(seg['start'], 2),
                'end': round(seg['end'], 2),
                'text': text
            })

    return {
        'text': ' '.join(s['text'] for s in segments),
        'segments': segments,
        'language': result.get('language', 'en')
    }


# ============ LYRICS ANALYSIS ============

def normalize_text_for_comparison(text: str) -> str:
    """Normalize text for comparison (lowercase, remove punctuation)."""
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    text = ' '.join(text.split())
    return text


def analyze_lyrics_structure(segments: list, duration: int) -> dict:
    """
    Analyze lyrics to detect song structure using line repetition.
    Lines that appear 2+ times are likely CHORUS.
    Lines that appear once are likely VERSE.
    """
    if not segments:
        return {'sections': [], 'energy_map': [], 'repeated_sections': {}}

    print(f"\n[STRUCTURE] Analyzing {len(segments)} lyric segments...")

    # Step 1: Count how many times each line appears
    line_occurrences = {}
    for seg in segments:
        text_normalized = normalize_text_for_comparison(seg['text'])
        if len(text_normalized) < 5:  # Skip very short lines
            continue
        if text_normalized not in line_occurrences:
            line_occurrences[text_normalized] = []
        line_occurrences[text_normalized].append(seg)

    # Identify chorus lines (appear 2+ times)
    chorus_lines = {text for text, occurrences in line_occurrences.items()
                    if len(occurrences) >= 2}

    print(f"[STRUCTURE] Found {len(chorus_lines)} repeated lines (likely chorus)")

    # Step 2: Group consecutive segments into sections
    sections = []
    current_section = None
    verse_count = 0
    chorus_count = 0

    for i, seg in enumerate(segments):
        text_normalized = normalize_text_for_comparison(seg['text'])

        # Determine if this line is chorus or verse
        if text_normalized in chorus_lines:
            section_type = 'chorus'
        else:
            section_type = 'verse'

        # Check if we should start a new section
        start_new_section = False

        if current_section is None:
            start_new_section = True
        elif current_section['type'] != section_type:
            # Type changed (verse → chorus or chorus → verse)
            start_new_section = True
        elif i > 0:
            # Check for time gap (> 4 seconds = new section)
            gap = seg['start'] - segments[i-1]['end']
            if gap > 4:
                start_new_section = True

        if start_new_section:
            # Finish current section
            if current_section is not None:
                current_section['end'] = segments[i-1]['end']
                sections.append(current_section)

            # Start new section
            if section_type == 'verse':
                verse_count += 1
                label = f'VERSE {verse_count}'
            else:
                chorus_count += 1
                label = 'CHORUS' if chorus_count == 1 else 'CHORUS (repeat)'

            current_section = {
                'type': section_type,
                'label': label,
                'start': seg['start'],
                'lines': [],
                'line_texts': []
            }

        # Add line to current section
        current_section['lines'].append(seg['text'])
        current_section['line_texts'].append(text_normalized)

    # Don't forget the last section
    if current_section is not None:
        current_section['end'] = segments[-1]['end']
        sections.append(current_section)

    # Step 3: Detect special sections (pre-chorus, bridge, intro, outro)
    for i, section in enumerate(sections):
        line_count = len(section['lines'])

        # Short section (1-3 lines) before chorus might be pre-chorus
        if section['type'] == 'verse' and line_count <= 3 and i < len(sections) - 1:
            next_section = sections[i + 1]
            if next_section['type'] == 'chorus':
                section['type'] = 'pre-chorus'
                section['label'] = 'PRE-CHORUS'
                # Adjust verse count
                verse_count -= 1

        # Unique section after 60% of song might be bridge
        if section['type'] == 'verse' and section['start'] > duration * 0.6:
            # Check if this section's content is unique (not repeated elsewhere)
            section_content = ' '.join(section['line_texts'][:3])
            is_unique = True
            for other in sections:
                if other is not section:
                    other_content = ' '.join(other.get('line_texts', [])[:3])
                    if text_similarity(section_content, other_content) > 0.5:
                        is_unique = False
                        break
            if is_unique and line_count <= 4:
                section['type'] = 'bridge'
                section['label'] = 'BRIDGE'

    # Intro/outro detection
    if sections:
        if sections[0]['start'] < 15 and len(sections[0]['lines']) <= 4:
            if sections[0]['type'] == 'verse':
                sections[0]['type'] = 'intro'
                sections[0]['label'] = 'INTRO'

        if sections[-1]['end'] > duration - 20:
            if sections[-1]['type'] not in ['chorus']:
                sections[-1]['type'] = 'outro'
                sections[-1]['label'] = 'OUTRO'

    # Step 4: Track repeated sections for choreography reuse
    repeated_sections = {}
    section_content_map = {}

    for i, section in enumerate(sections):
        content_key = ' '.join(section.get('line_texts', [])[:4])
        if content_key in section_content_map:
            original_idx = section_content_map[content_key]
            if original_idx not in repeated_sections:
                repeated_sections[original_idx] = []
            repeated_sections[original_idx].append(i)
            section['repeat_of'] = original_idx
        else:
            section_content_map[content_key] = i

    # Step 5: Create energy map
    energy_map = []
    for section in sections:
        if section['type'] == 'chorus':
            energy = 0.9
        elif section['type'] == 'pre-chorus':
            energy = 0.7
        elif section['type'] == 'bridge':
            energy = 0.75
        elif section['type'] == 'intro':
            energy = 0.4
        elif section['type'] == 'outro':
            energy = 0.3
        else:
            energy = 0.5

        energy_map.append({
            'start': section['start'],
            'end': section['end'],
            'energy': energy,
            'type': section['type'],
            'label': section.get('label', section['type'].upper())
        })

    # Log detected structure
    print(f"[STRUCTURE] Detected sections:")
    for section in sections:
        repeat_info = ""
        if 'repeat_of' in section:
            orig = sections[section['repeat_of']]
            repeat_info = f" [REPEATED - same moves as {orig['label']} at {orig['start']:.0f}s]"
        print(f"  - {section['label']}: {section['start']:.0f}s - {section['end']:.0f}s ({len(section['lines'])} lines){repeat_info}")

    return {
        'sections': sections,
        'energy_map': energy_map,
        'repeated_sections': repeated_sections
    }


# ============ CHOREOGRAPHY GENERATION ============

def generate_choreography(song_info: dict, lyrics_data: dict, structure: dict,
                          duration: int, api_key: str) -> list:
    """Generate choreography using Claude API based on lyrics structure."""
    import urllib.request

    sections = structure.get('sections', [])
    sections_desc = '\n'.join([
        f"- {s.get('label', s['type'].upper())} ({s['start']:.0f}s - {s['end']:.0f}s): {' / '.join(s['lines'][:3])}"
        for s in sections[:12]
    ])

    # Build repetition info
    repeated_sections = structure.get('repeated_sections', {})
    repetition_info = ""
    if repeated_sections:
        repetition_info = "\n\n🔄 REPEATED SECTIONS (use SAME moves):"
        for orig_idx, repeat_indices in repeated_sections.items():
            if orig_idx < len(sections):
                orig_section = sections[int(orig_idx)]
                for rep_idx in repeat_indices:
                    if rep_idx < len(sections):
                        rep_section = sections[rep_idx]
                        repetition_info += f"\n  - {rep_section.get('label', 'Section')} at {rep_section['start']:.0f}s = SAME as {orig_section.get('label', 'Section')} at {orig_section['start']:.0f}s"

    # Build lyrics timing info for instrumental detection
    lyrics_segments = lyrics_data.get('segments', [])
    lyrics_timing = ""
    if lyrics_segments:
        first_lyric = lyrics_segments[0]['start']
        last_lyric = lyrics_segments[-1]['end']
        lyrics_timing = f"\nLyrics timing: {first_lyric:.0f}s to {last_lyric:.0f}s"
        if first_lyric > 10:
            lyrics_timing += f"\n⚠️ INSTRUMENTAL INTRO: 0s - {first_lyric:.0f}s (NO MOVES HERE)"
        if duration - last_lyric > 15:
            lyrics_timing += f"\n⚠️ INSTRUMENTAL OUTRO: {last_lyric:.0f}s - {duration}s (NO MOVES HERE)"

        # Detect gaps in lyrics > 8 seconds
        for i in range(len(lyrics_segments) - 1):
            gap_start = lyrics_segments[i]['end']
            gap_end = lyrics_segments[i + 1]['start']
            if gap_end - gap_start > 8:
                lyrics_timing += f"\n⚠️ INSTRUMENTAL BREAK: {gap_start:.0f}s - {gap_end:.0f}s (NO MOVES HERE)"

    prompt = f'''You are a dance choreographer creating a beginner-friendly routine for:
Song: "{song_info['title']}" by {song_info['artist']}
Duration: {duration} seconds

Song Structure:
{sections_desc if sections_desc else "No clear structure detected"}
{lyrics_timing}
{repetition_info}

Available moves (use ONLY these IDs):
EASY (1 star): step_touch, hip_sway, clap, slide, snap, point, stomp, groove, sway, twist
MEDIUM (2 star): body_roll, arm_wave, turn, jump, shoulder_pop, punch, shimmy

Rules:
1. Generate moves every 3-5 seconds ONLY during sections with lyrics
2. INTRO: Use easy moves (step_touch, sway, groove) - but SKIP if instrumental
3. VERSE: Mix of easy and medium moves
4. CHORUS: Higher energy moves
5. BRIDGE: Unique standout moves
6. OUTRO: Wind down with easy moves - but SKIP if instrumental
7. ⚠️ CRITICAL: Do NOT generate moves during INSTRUMENTAL sections marked above
8. ⚠️ CRITICAL: For REPEATED SECTIONS (marked with 🔄 above), use the EXACT SAME move sequence as the original section. This makes the dance easier to learn!
9. Vary body parts - don't repeat same type 3x in a row (except for repeated sections)

Return JSON array only:
[
  {{"moveId": "step_touch", "timestamp": 5, "beats": 8}},
  {{"moveId": "clap", "timestamp": 10, "beats": 4}},
  ...
]'''

    headers = {
        'Content-Type': 'application/json',
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01'
    }

    data = json.dumps({
        'model': 'claude-sonnet-4-20250514',
        'max_tokens': 2048,
        'messages': [{'role': 'user', 'content': prompt}]
    }).encode()

    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages',
        data=data,
        headers=headers
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            content = result['content'][0]['text']

            # Extract JSON array
            match = re.search(r'\[[\s\S]*\]', content)
            if match:
                moves = json.loads(match.group())
                return moves
    except Exception as e:
        print(f"Choreography generation error: {e}")

    # Fallback: generate basic routine
    return generate_fallback_routine(duration)


def generate_fallback_routine(duration: int) -> list:
    """Generate a basic routine if API fails."""
    easy = ['step_touch', 'hip_sway', 'clap', 'slide', 'groove', 'sway']
    medium = ['body_roll', 'arm_wave', 'turn', 'jump']

    moves = []
    timestamp = 5
    while timestamp < duration - 10:
        move_pool = easy if timestamp < 30 or timestamp > duration - 30 else easy + medium
        import random
        moves.append({
            'moveId': random.choice(move_pool),
            'timestamp': timestamp,
            'beats': random.choice([4, 8])
        })
        timestamp += random.randint(3, 6)

    return moves


# ============ STATIC FILE ROUTES ============

@app.route('/')
def index():
    """Serve the main app."""
    return send_from_directory('.', 'index.html')


@app.route('/admin')
def admin_page():
    """Serve the admin page."""
    return send_from_directory('.', 'admin.html')


@app.route('/editor')
def editor_page():
    """Serve the lyrics timestamp editor page."""
    return send_from_directory('.', 'editor.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files."""
    return send_from_directory('.', path)


# ============ PUBLIC API ROUTES ============

@app.route('/api/songs')
@app.route('/api/library')
def get_library():
    """Get all published songs for the library."""
    songs = db.get_published_songs()
    return jsonify(songs)


@app.route('/api/songs/<video_id>')
@app.route('/api/song/<video_id>')
def get_song(video_id):
    """Get a song with its routine for playback."""
    data = db.get_song_with_routine(video_id)
    if not data or not data['song'].get('published'):
        return jsonify({'error': 'Song not found'}), 404
    return jsonify(data)


@app.route('/api/requests', methods=['POST'])
@app.route('/api/request', methods=['POST'])
def submit_request():
    """Submit a song request."""
    data = request.get_json()
    url = data.get('youtube_url', '').strip()

    if not url:
        return jsonify({'error': 'YouTube URL required'}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    # Check if already in library
    if db.song_exists(video_id):
        return jsonify({'error': 'Song already in library'}), 400

    result = db.create_request(url, data.get('user_note'))
    return jsonify({'success': True, 'request': result})


# ============ ADMIN API ROUTES ============

@app.route('/api/admin/songs')
@require_admin
def admin_get_songs():
    """Get all songs (admin)."""
    return jsonify(db.get_all_songs())


@app.route('/api/admin/requests')
@require_admin
def admin_get_requests():
    """Get all song requests (admin)."""
    return jsonify(db.get_all_requests())


@app.route('/api/admin/request/<int:request_id>', methods=['PATCH'])
@require_admin
def admin_update_request(request_id):
    """Update request status (admin)."""
    data = request.get_json()
    status = data.get('status')

    if status not in ('pending', 'approved', 'rejected'):
        return jsonify({'error': 'Invalid status'}), 400

    if db.update_request_status(request_id, status):
        return jsonify({'success': True})
    return jsonify({'error': 'Request not found'}), 404


@app.route('/api/admin/process', methods=['POST'])
@require_admin
def admin_process_song():
    """Process a new song (transcribe, analyze, generate choreography)."""
    data = request.get_json()
    url = data.get('youtube_url', '').strip()
    api_key = data.get('api_key', '').strip()
    lyrics_mode = data.get('lyrics_mode', 'auto')  # 'auto' or 'manual'
    manual_lyrics = data.get('manual_lyrics', '').strip()

    if not url:
        return jsonify({'error': 'YouTube URL required'}), 400
    if not api_key:
        return jsonify({'error': 'Claude API key required'}), 400
    if lyrics_mode == 'manual' and not manual_lyrics:
        return jsonify({'error': 'Manual lyrics required when using manual mode'}), 400

    video_id = extract_video_id(url)
    if not video_id:
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    try:
        # Step 1: Get video info
        print(f"\n[PROCESS] Step 1: Fetching video info for {video_id}")
        info = get_youtube_info(video_id)
        print(f"[PROCESS]   Title: {info['title']}")
        print(f"[PROCESS]   Artist: {info['artist']}")
        print(f"[PROCESS]   Thumbnail: {info.get('thumbnail_url', 'None')[:50]}...")

        # Step 2: Download audio
        print(f"\n[PROCESS] Step 2: Downloading audio...")
        cached = (CACHE_DIR / f"{video_id}.mp3").exists()
        audio_path = download_audio(video_id)
        print(f"[PROCESS]   {'Using cached audio' if cached else 'Audio downloaded'}: {audio_path}")

        # Step 3: Transcribe/Align lyrics
        if lyrics_mode == 'manual':
            print(f"\n[PROCESS] Step 3: Aligning manual lyrics to audio...")
            print(f"[PROCESS]   Mode: MANUAL ({len(manual_lyrics.split(chr(10)))} lines provided)")

            # Still run Whisper to get timestamp hints
            print(f"[PROCESS]   Running Whisper for timestamp detection...")
            whisper_result = transcribe_audio(audio_path)
            whisper_segments = whisper_result.get('segments', [])
            print(f"[PROCESS]   Whisper found {len(whisper_segments)} vocal segments for timing")

            # Get duration for alignment
            result = subprocess.run(
                ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                 '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
                capture_output=True, text=True
            )
            duration = int(float(result.stdout.strip())) if result.stdout.strip() else 180

            # Align manual lyrics to Whisper timestamps
            aligned_segments = align_manual_lyrics(manual_lyrics, whisper_segments, duration)
            lyrics = {
                'text': manual_lyrics,
                'segments': aligned_segments,
                'language': whisper_result.get('language', 'unknown'),
                'source': 'manual'
            }
            print(f"[PROCESS]   Aligned {len(aligned_segments)} lyric segments")
        else:
            print(f"\n[PROCESS] Step 3: Transcribing with Whisper...")
            print(f"[PROCESS]   Mode: AUTO (Whisper transcription)")
            lyrics = transcribe_audio(audio_path)
            lyrics['source'] = 'whisper'

        print(f"[PROCESS]   Language detected: {lyrics.get('language', 'unknown')}")
        print(f"[PROCESS]   Segments found: {len(lyrics['segments'])}")
        if lyrics['segments']:
            print(f"[PROCESS]   First 3 lines:")
            for seg in lyrics['segments'][:3]:
                print(f"[PROCESS]     [{seg['start']:.1f}s] {seg['text'][:60]}...")

        # Get duration from audio
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
            capture_output=True, text=True
        )
        duration = int(float(result.stdout.strip())) if result.stdout.strip() else 180
        print(f"[PROCESS]   Duration: {duration}s ({duration // 60}:{duration % 60:02d})")

        # Step 3b: Detect BPM using librosa
        bpm = None
        try:
            import librosa
            import numpy as np
            print(f"[PROCESS]   Detecting BPM with librosa...")
            y, sr = librosa.load(audio_path, sr=22050, duration=60)  # Load first 60 seconds
            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            # Handle different librosa versions - tempo can be scalar or array
            if isinstance(tempo, np.ndarray):
                bpm = float(tempo[0]) if len(tempo) > 0 else 120.0
            elif hasattr(tempo, 'item'):
                bpm = float(tempo.item())
            else:
                bpm = float(tempo)
            bpm = round(bpm, 1)
            print(f"[PROCESS]   BPM detected: {bpm}")
        except ImportError:
            print(f"[PROCESS]   WARNING: librosa not installed, using default BPM 120")
            bpm = 120.0
        except Exception as e:
            print(f"[PROCESS]   WARNING: BPM detection failed: {e}, using default 120")
            bpm = 120.0

        # Step 4: Analyze structure
        print(f"\n[PROCESS] Step 4: Analyzing lyrics structure...")
        structure = analyze_lyrics_structure(lyrics['segments'], duration)
        print(f"[PROCESS]   Sections found: {len(structure.get('sections', []))}")
        for section in structure.get('sections', [])[:5]:
            print(f"[PROCESS]     {section['type'].upper()}: {section['start']:.0f}s - {section['end']:.0f}s ({len(section['lines'])} lines)")

        # Step 5: Generate choreography
        print(f"\n[PROCESS] Step 5: Generating choreography with Claude...")

        # Log repeated sections info
        repeated = structure.get('repeated_sections', {})
        if repeated:
            print(f"[PROCESS]   Repeated sections detected:")
            for orig_idx, repeat_indices in repeated.items():
                sections = structure.get('sections', [])
                if int(orig_idx) < len(sections):
                    orig = sections[int(orig_idx)]
                    for rep_idx in repeat_indices:
                        if rep_idx < len(sections):
                            rep = sections[rep_idx]
                            print(f"[PROCESS]     {rep.get('label', 'Section')} at {rep['start']:.0f}s → uses same moves as {orig.get('label', 'Section')} at {orig['start']:.0f}s")

        moves = generate_choreography(info, lyrics, structure, duration, api_key)
        print(f"[PROCESS]   Moves generated: {len(moves)}")

        # Normalize moves: ensure consistent field names (startTime instead of timestamp)
        normalized_moves = []
        for move in moves:
            normalized_move = {
                'moveId': move.get('moveId', 'step_touch'),
                'startTime': move.get('startTime') or move.get('timestamp', 0),
                'beats': move.get('beats', 8)
            }
            normalized_moves.append(normalized_move)

        print(f"[PROCESS]   Normalized moves: {len(normalized_moves)}")
        for move in normalized_moves[:5]:
            print(f"[PROCESS]     [{move['startTime']:.0f}s] {move['moveId']} ({move['beats']} beats)")
        if len(normalized_moves) > 5:
            print(f"[PROCESS]     ... and {len(normalized_moves) - 5} more moves")

        # Add BPM to structure
        structure['estimatedBPM'] = bpm

        # Step 6: Save to database (separate lyrics and routine)
        print(f"\n[PROCESS] Step 6: Saving to database...")

        # Save song metadata (without lyrics)
        db.save_song(
            video_id=video_id,
            title=info['title'],
            artist=info['artist'],
            youtube_url=url,
            lyrics_json=None,  # Lyrics now stored separately
            duration=duration,
            bpm=bpm,
            thumbnail_url=info.get('thumbnail_url', ''),
            difficulty=2,
            published=False
        )
        print(f"[PROCESS]   Song metadata saved! ID: {video_id}")

        # Save lyrics separately (preserves even if choreography regenerated)
        db.save_lyrics(video_id, lyrics['segments'], structure.get('sections'))
        print(f"[PROCESS]   Lyrics saved! {len(lyrics['segments'])} segments")

        # Save routine (choreography)
        saved_routine = db.save_routine(video_id, normalized_moves, version_name='Original', is_default=True)
        print(f"[PROCESS]   Routine saved! Moves in DB: {len(saved_routine.get('moves', []))}")
        print(f"[PROCESS]   BPM: {bpm:.1f}")
        print(f"[PROCESS] ✅ Processing complete!\n")

        return jsonify({
            'success': True,
            'video_id': video_id,
            'song': db.get_song(video_id),
            'routine': db.get_routine(video_id),
            'lyrics': lyrics,
            'structure': structure
        })

    except Exception as e:
        import traceback
        print(f"\n[PROCESS] ❌ Error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/song/<video_id>', methods=['PATCH'])
@require_admin
def admin_update_song(video_id):
    """Update song details (admin)."""
    data = request.get_json()

    result = db.update_song(video_id, **data)
    if result:
        return jsonify(result)
    return jsonify({'error': 'Song not found'}), 404


@app.route('/api/admin/song/<video_id>/publish', methods=['POST'])
@require_admin
def admin_publish_song(video_id):
    """Publish a song to the library."""
    result = db.update_song(video_id, published=1)
    if result:
        return jsonify({'success': True, 'song': result})
    return jsonify({'error': 'Song not found'}), 404


@app.route('/api/admin/song/<video_id>/unpublish', methods=['POST'])
@require_admin
def admin_unpublish_song(video_id):
    """Unpublish a song from the library."""
    result = db.update_song(video_id, published=0)
    if result:
        return jsonify({'success': True, 'song': result})
    return jsonify({'error': 'Song not found'}), 404


@app.route('/api/admin/song/<video_id>', methods=['DELETE'])
@require_admin
def admin_delete_song(video_id):
    """Delete a song."""
    if db.delete_song(video_id):
        return jsonify({'success': True})
    return jsonify({'error': 'Song not found'}), 404


@app.route('/api/admin/song/<video_id>/routine', methods=['POST'])
@require_admin
def admin_update_routine(video_id):
    """Update or regenerate a routine."""
    data = request.get_json()
    moves = data.get('moves', [])
    structure = data.get('structure')

    if moves:
        db.save_routine(video_id, moves, structure)
        return jsonify({'success': True, 'routine': db.get_routine(video_id)})


@app.route('/api/admin/song/<video_id>/timestamps', methods=['POST'])
@require_admin
def admin_update_timestamps(video_id):
    """Update lyrics timestamps for a song (saves to separate lyrics table, preserves choreography)."""
    data = request.get_json()
    segments = data.get('segments', [])
    offset = data.get('offset', 0)  # Optional bulk offset

    # Get existing song
    song = db.get_song(video_id)
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    # Apply bulk offset if provided
    if offset != 0:
        for seg in segments:
            seg['start'] = max(0, seg.get('start', 0) + offset)
            if 'end' in seg:
                seg['end'] = max(0, seg['end'] + offset)

    # Save to separate lyrics table (doesn't affect routines/choreography)
    db.update_lyrics_timestamps(video_id, segments)

    print(f"[LYRICS] Updated {len(segments)} lyrics timestamps for {video_id}")
    print(f"[LYRICS]   Note: Choreography unchanged (lyrics saved separately)")
    if offset != 0:
        print(f"[LYRICS]   Applied offset: {offset:+.1f}s")

    return jsonify({
        'success': True,
        'segments': segments,
        'count': len(segments)
    })


# ============ LYRICS API ============

@app.route('/api/songs/<video_id>/lyrics', methods=['GET'])
def get_song_lyrics(video_id):
    """Get lyrics for a song (public API)."""
    lyrics = db.get_lyrics(video_id)
    if lyrics:
        return jsonify(lyrics)
    return jsonify({'error': 'Lyrics not found'}), 404


@app.route('/api/admin/song/<video_id>/lyrics', methods=['PUT'])
@require_admin
def admin_update_lyrics(video_id):
    """Update lyrics for a song (admin only)."""
    data = request.get_json()
    segments = data.get('segments', [])
    structure = data.get('structure')

    result = db.save_lyrics(video_id, segments, structure)
    if result:
        print(f"[LYRICS] Full update for {video_id}: {len(segments)} segments")
        return jsonify({'success': True, 'lyrics': result})
    return jsonify({'error': 'Failed to save lyrics'}), 500


@app.route('/api/songs/<video_id>/waveform', methods=['GET'])
def get_song_waveform(video_id):
    """
    Get waveform data for audio visualization.
    Returns amplitude samples for the entire song duration.
    """
    import numpy as np

    # Check if audio file exists
    audio_path = CACHE_DIR / f"{video_id}.mp3"
    if not audio_path.exists():
        # Try other extensions
        for ext in ['m4a', 'webm', 'wav']:
            alt_path = CACHE_DIR / f"{video_id}.{ext}"
            if alt_path.exists():
                audio_path = alt_path
                break
        else:
            return jsonify({'error': 'Audio file not found', 'samples': []}), 404

    try:
        import librosa

        # Load audio file
        print(f"[WAVEFORM] Loading audio for {video_id}...")
        y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
        duration = len(y) / sr

        # Calculate samples per second (aim for ~20 samples per second for detailed view)
        samples_per_second = 20
        total_samples = int(duration * samples_per_second)

        # Downsample by taking max amplitude in each window
        window_size = len(y) // total_samples
        samples = []

        for i in range(total_samples):
            start = i * window_size
            end = min(start + window_size, len(y))
            if start < len(y):
                # Get RMS (root mean square) for this window - better than max for visualization
                window = y[start:end]
                rms = np.sqrt(np.mean(window ** 2))
                samples.append(float(rms))

        # Normalize to 0-1 range
        if samples:
            max_val = max(samples) if max(samples) > 0 else 1
            samples = [s / max_val for s in samples]

        print(f"[WAVEFORM] Generated {len(samples)} samples for {duration:.1f}s audio")

        return jsonify({
            'samples': samples,
            'duration': duration,
            'samples_per_second': samples_per_second
        })

    except ImportError:
        print("[WAVEFORM] librosa not installed, returning empty waveform")
        return jsonify({'error': 'librosa not installed', 'samples': []}), 500
    except Exception as e:
        print(f"[WAVEFORM] Error generating waveform: {e}")
        return jsonify({'error': str(e), 'samples': []}), 500


# ============ ROUTINES API (Multiple Choreographies) ============

@app.route('/api/songs/<video_id>/routines', methods=['GET'])
def get_song_routines(video_id):
    """Get all choreography versions for a song."""
    routines = db.get_all_routines(video_id)
    return jsonify({'routines': routines, 'count': len(routines)})


@app.route('/api/admin/song/<video_id>/routines', methods=['POST'])
@require_admin
def admin_create_routine(video_id):
    """Create a new choreography version for a song."""
    data = request.get_json()
    moves = data.get('moves', [])
    version_name = data.get('version_name', 'New Version')
    is_default = data.get('is_default', False)

    if not moves:
        return jsonify({'error': 'Moves are required'}), 400

    routine = db.save_routine(video_id, moves, version_name=version_name, is_default=is_default)
    print(f"[ROUTINE] Created new version '{version_name}' for {video_id}: {len(moves)} moves")

    return jsonify({'success': True, 'routine': routine})


@app.route('/api/admin/routines/<int:routine_id>', methods=['PUT'])
@require_admin
def admin_update_routine_by_id(routine_id):
    """Update a specific choreography routine."""
    data = request.get_json()
    moves = data.get('moves')
    version_name = data.get('version_name')
    is_default = data.get('is_default')

    routine = db.update_routine(routine_id, move_sequence=moves, version_name=version_name, is_default=is_default)
    if routine:
        print(f"[ROUTINE] Updated routine {routine_id}")
        return jsonify({'success': True, 'routine': routine})
    return jsonify({'error': 'Routine not found'}), 404


@app.route('/api/admin/routines/<int:routine_id>', methods=['DELETE'])
@require_admin
def admin_delete_routine(routine_id):
    """Delete a choreography routine."""
    if db.delete_routine(routine_id):
        print(f"[ROUTINE] Deleted routine {routine_id}")
        return jsonify({'success': True})
    return jsonify({'error': 'Routine not found'}), 404


@app.route('/api/admin/routines/<int:routine_id>/default', methods=['POST'])
@require_admin
def admin_set_default_routine(routine_id):
    """Set a routine as the default for its song."""
    if db.set_default_routine(routine_id):
        print(f"[ROUTINE] Set routine {routine_id} as default")
        return jsonify({'success': True})
    return jsonify({'error': 'Routine not found'}), 404


@app.route('/api/admin/song/<video_id>/regenerate', methods=['POST'])
@require_admin
def admin_regenerate_choreography(video_id):
    """Regenerate choreography for a song (creates new version, preserves lyrics)."""
    data = request.get_json()
    api_key = data.get('api_key', '').strip()
    version_name = data.get('version_name', 'Regenerated')
    set_as_default = data.get('set_as_default', False)

    if not api_key:
        return jsonify({'error': 'Claude API key required'}), 400

    # Get existing song data
    song = db.get_song(video_id)
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    # Get lyrics from separate table
    lyrics_data = db.get_lyrics(video_id)
    if not lyrics_data:
        return jsonify({'error': 'No lyrics found for this song'}), 404

    try:
        lyrics = {'segments': lyrics_data.get('segments', [])}
        structure = {'sections': lyrics_data.get('structure', [])}
        duration = song.get('duration', 180)

        info = {
            'title': song['title'],
            'artist': song['artist']
        }

        print(f"\n[REGENERATE] Creating new choreography for {video_id}")
        print(f"[REGENERATE]   Version name: {version_name}")
        print(f"[REGENERATE]   Using existing lyrics: {len(lyrics['segments'])} segments")

        # Generate new choreography
        moves = generate_choreography(info, lyrics, structure, duration, api_key)

        # Normalize moves
        normalized_moves = []
        for move in moves:
            normalized_moves.append({
                'moveId': move.get('moveId', 'step_touch'),
                'startTime': move.get('startTime') or move.get('timestamp', 0),
                'beats': move.get('beats', 8)
            })

        # Save as new routine (doesn't affect lyrics!)
        routine = db.save_routine(video_id, normalized_moves, version_name=version_name, is_default=set_as_default)

        print(f"[REGENERATE] ✅ New choreography created: {len(normalized_moves)} moves")
        print(f"[REGENERATE]   Lyrics preserved: {len(lyrics['segments'])} segments unchanged")

        return jsonify({
            'success': True,
            'routine': routine,
            'moves_count': len(normalized_moves)
        })

    except Exception as e:
        import traceback
        print(f"[REGENERATE] ❌ Error: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============ STARTUP ============

if __name__ == '__main__':
    # Initialize database
    db.init_database()
    db.populate_default_moves()

    # Find available port
    for port in [5000, 5001, 8080, 8000]:
        if is_port_available(port):
            break
    else:
        print("ERROR: No available ports!")
        exit(1)

    print("=" * 50)
    print("Dance Card Generator Server")
    print("=" * 50)
    print(f"Port: {port}")
    print(f"Whisper model: {WHISPER_MODEL}")
    print(f"Admin password: {ADMIN_PASSWORD}")
    print(f"URL: http://localhost:{port}")
    print(f"Admin: http://localhost:{port}/admin")
    print("=" * 50)

    # Preload Whisper
    try:
        get_whisper_model()
    except ImportError:
        print("\nERROR: Whisper not installed!")
        print("Run: pip install openai-whisper")
        exit(1)

    app.run(host='0.0.0.0', port=port, debug=True)
