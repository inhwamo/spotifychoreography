#!/usr/bin/env python3
"""
Dance Card Generator - Backend Server
Handles YouTube audio download and Whisper transcription
"""

import os
import json
import hashlib
import subprocess
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='.')
CORS(app)

# Cache directory for transcriptions
CACHE_DIR = Path(__file__).parent / '.lyrics_cache'
CACHE_DIR.mkdir(exist_ok=True)

# Whisper model to use (tiny, base, small, medium, large)
# Start with 'base' for balance of speed/accuracy
WHISPER_MODEL = os.environ.get('WHISPER_MODEL', 'base')

# Global whisper model (lazy loaded)
_whisper_model = None


def get_whisper_model():
    """Lazy load the whisper model"""
    global _whisper_model
    if _whisper_model is None:
        import whisper
        print(f"Loading Whisper model: {WHISPER_MODEL}")
        _whisper_model = whisper.load_model(WHISPER_MODEL)
        print("Whisper model loaded!")
    return _whisper_model


def get_cache_path(video_id: str) -> Path:
    """Get the cache file path for a video ID"""
    return CACHE_DIR / f"{video_id}.json"


def load_cached_lyrics(video_id: str) -> dict | None:
    """Load cached lyrics if they exist"""
    cache_path = get_cache_path(video_id)
    if cache_path.exists():
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
    return None


def save_cached_lyrics(video_id: str, data: dict):
    """Save lyrics to cache"""
    cache_path = get_cache_path(video_id)
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def download_audio(video_id: str, output_dir: str) -> str:
    """Download audio from YouTube using yt-dlp"""
    url = f"https://www.youtube.com/watch?v={video_id}"
    output_path = os.path.join(output_dir, f"{video_id}.%(ext)s")

    cmd = [
        'yt-dlp',
        '-x',  # Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '0',  # Best quality
        '-o', output_path,
        '--no-playlist',
        '--quiet',
        url
    ]

    subprocess.run(cmd, check=True)

    # Find the output file
    for ext in ['mp3', 'webm', 'm4a', 'opus']:
        path = os.path.join(output_dir, f"{video_id}.{ext}")
        if os.path.exists(path):
            return path

    raise FileNotFoundError(f"Could not find downloaded audio for {video_id}")


def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio using Whisper and return timestamped segments"""
    model = get_whisper_model()

    # Transcribe with word-level timestamps
    result = model.transcribe(
        audio_path,
        word_timestamps=True,
        verbose=False
    )

    # Extract segments with timestamps
    segments = []
    for segment in result.get('segments', []):
        segments.append({
            'start': round(segment['start'], 2),
            'end': round(segment['end'], 2),
            'text': segment['text'].strip()
        })

    return {
        'text': result.get('text', '').strip(),
        'segments': segments,
        'language': result.get('language', 'en')
    }


@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)


@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio from a YouTube video

    Request body: { "videoId": "dQw4w9WgXcQ" }
    Response: { "text": "...", "segments": [...], "cached": true/false }
    """
    data = request.get_json()
    video_id = data.get('videoId')
    force = data.get('force', False)

    if not video_id:
        return jsonify({'error': 'Missing videoId'}), 400

    # Validate video ID format
    if not video_id.replace('-', '').replace('_', '').isalnum():
        return jsonify({'error': 'Invalid videoId format'}), 400

    # Check cache first (unless force refresh)
    if not force:
        cached = load_cached_lyrics(video_id)
        if cached:
            cached['cached'] = True
            return jsonify(cached)

    try:
        # Download and transcribe in a temp directory
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Downloading audio for {video_id}...")
            audio_path = download_audio(video_id, temp_dir)

            print(f"Transcribing {audio_path}...")
            result = transcribe_audio(audio_path)

        # Cache the result
        save_cached_lyrics(video_id, result)
        result['cached'] = False

        return jsonify(result)

    except subprocess.CalledProcessError as e:
        return jsonify({'error': f'Failed to download audio: {str(e)}'}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/cache/<video_id>', methods=['GET'])
def get_cached(video_id):
    """Check if lyrics are cached for a video"""
    cached = load_cached_lyrics(video_id)
    if cached:
        return jsonify({'cached': True, **cached})
    return jsonify({'cached': False})


@app.route('/api/cache/<video_id>', methods=['DELETE'])
def delete_cached(video_id):
    """Delete cached lyrics for a video"""
    cache_path = get_cache_path(video_id)
    if cache_path.exists():
        cache_path.unlink()
        return jsonify({'deleted': True})
    return jsonify({'deleted': False})


if __name__ == '__main__':
    print("=" * 50)
    print("Dance Card Generator - Backend Server")
    print("=" * 50)
    print(f"Whisper model: {WHISPER_MODEL}")
    print(f"Cache directory: {CACHE_DIR}")
    print()
    print("Starting server at http://localhost:5000")
    print("(Frontend should also be served from here)")
    print("=" * 50)

    # Preload the model on startup
    try:
        get_whisper_model()
    except ImportError:
        print("\nERROR: Whisper not installed!")
        print("Run: pip install openai-whisper")
        exit(1)

    app.run(host='0.0.0.0', port=5000, debug=True)
