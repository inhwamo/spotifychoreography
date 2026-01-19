"""
Database Module for Dance Card Generator
Handles SQLite database operations for songs, routines, moves, and requests.
"""

import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# Database file path
DB_PATH = Path(__file__).parent / 'dancecard.db'


def get_connection() -> sqlite3.Connection:
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Initialize the database with all required tables."""
    conn = get_connection()
    cursor = conn.cursor()

    # Songs table - stores all song metadata and lyrics
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            video_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            youtube_url TEXT NOT NULL,
            lyrics_json TEXT,
            genre TEXT,
            duration INTEGER,
            bpm REAL,
            thumbnail_url TEXT,
            difficulty INTEGER DEFAULT 2,
            published INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add bpm column if it doesn't exist (migration for existing databases)
    try:
        cursor.execute('ALTER TABLE songs ADD COLUMN bpm REAL')
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Moves table - catalog of available dance moves
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS moves (
            move_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            difficulty INTEGER DEFAULT 1,
            body_part TEXT,
            description TEXT,
            pictogram_svg TEXT
        )
    ''')

    # Routines table - choreography sequences for songs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS routines (
            routine_id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            move_sequence_json TEXT NOT NULL,
            song_structure_json TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES songs(video_id)
        )
    ''')

    # Song requests table - user-submitted song requests
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS song_requests (
            request_id INTEGER PRIMARY KEY AUTOINCREMENT,
            youtube_url TEXT NOT NULL,
            user_note TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")


# ============ SONG OPERATIONS ============

def get_song(video_id: str) -> Optional[Dict]:
    """Get a song by video ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM songs WHERE video_id = ?', (video_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return None


def get_published_songs() -> List[Dict]:
    """Get all published songs for the library."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, r.routine_id
        FROM songs s
        LEFT JOIN routines r ON s.video_id = r.video_id
        WHERE s.published = 1
        ORDER BY s.created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_songs() -> List[Dict]:
    """Get all songs (for admin)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, r.routine_id
        FROM songs s
        LEFT JOIN routines r ON s.video_id = r.video_id
        ORDER BY s.created_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def song_exists(video_id: str) -> bool:
    """Check if a song exists in the database."""
    return get_song(video_id) is not None


def save_song(video_id: str, title: str, artist: str, youtube_url: str,
              lyrics_json: Optional[str] = None, genre: Optional[str] = None,
              duration: Optional[int] = None, bpm: Optional[float] = None,
              thumbnail_url: Optional[str] = None,
              difficulty: int = 2, published: bool = False) -> Dict:
    """Save or update a song."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO songs
        (video_id, title, artist, youtube_url, lyrics_json, genre, duration, bpm,
         thumbnail_url, difficulty, published, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (video_id, title, artist, youtube_url, lyrics_json, genre, duration, bpm,
          thumbnail_url, difficulty, 1 if published else 0, datetime.now().isoformat()))

    conn.commit()
    conn.close()

    return get_song(video_id)


def update_song(video_id: str, **kwargs) -> Optional[Dict]:
    """Update specific fields of a song."""
    if not song_exists(video_id):
        return None

    allowed_fields = ['title', 'artist', 'lyrics_json', 'genre', 'duration',
                      'bpm', 'thumbnail_url', 'difficulty', 'published']

    updates = {k: v for k, v in kwargs.items() if k in allowed_fields}
    if not updates:
        return get_song(video_id)

    conn = get_connection()
    cursor = conn.cursor()

    set_clause = ', '.join([f'{k} = ?' for k in updates.keys()])
    values = list(updates.values()) + [video_id]

    cursor.execute(f'UPDATE songs SET {set_clause} WHERE video_id = ?', values)
    conn.commit()
    conn.close()

    return get_song(video_id)


def delete_song(video_id: str) -> bool:
    """Delete a song and its routines."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM routines WHERE video_id = ?', (video_id,))
    cursor.execute('DELETE FROM songs WHERE video_id = ?', (video_id,))

    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return deleted


# ============ ROUTINE OPERATIONS ============

def get_routine(video_id: str) -> Optional[Dict]:
    """Get the routine for a song."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM routines WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', (video_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        result = dict(row)
        # Parse JSON fields
        if result.get('move_sequence_json'):
            result['moves'] = json.loads(result['move_sequence_json'])
        if result.get('song_structure_json'):
            result['structure'] = json.loads(result['song_structure_json'])
        return result
    return None


def save_routine(video_id: str, move_sequence: List[Dict],
                 song_structure: Optional[Dict] = None) -> Dict:
    """Save a routine for a song."""
    conn = get_connection()
    cursor = conn.cursor()

    # Delete existing routine for this song
    cursor.execute('DELETE FROM routines WHERE video_id = ?', (video_id,))

    # Insert new routine
    cursor.execute('''
        INSERT INTO routines (video_id, move_sequence_json, song_structure_json)
        VALUES (?, ?, ?)
    ''', (video_id, json.dumps(move_sequence),
          json.dumps(song_structure) if song_structure else None))

    conn.commit()
    conn.close()

    return get_routine(video_id)


# ============ MOVE CATALOG OPERATIONS ============

def get_all_moves() -> List[Dict]:
    """Get all moves from the catalog."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM moves ORDER BY difficulty, name')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_move(move_id: str) -> Optional[Dict]:
    """Get a specific move by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM moves WHERE move_id = ?', (move_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def save_move(move_id: str, name: str, difficulty: int = 1,
              body_part: str = '', description: str = '',
              pictogram_svg: str = '') -> Dict:
    """Save or update a move."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO moves
        (move_id, name, difficulty, body_part, description, pictogram_svg)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (move_id, name, difficulty, body_part, description, pictogram_svg))

    conn.commit()
    conn.close()

    return get_move(move_id)


def populate_default_moves():
    """Populate the moves table with default dance moves."""
    from moves import MOVE_CATALOG

    for move_id, move_data in MOVE_CATALOG.items():
        save_move(
            move_id=move_id,
            name=move_data['name'],
            difficulty=move_data['difficulty'],
            body_part=move_data['bodyPart'],
            description=move_data.get('description', ''),
            pictogram_svg=move_data.get('pictogram', '')
        )
    print(f"Populated {len(MOVE_CATALOG)} moves into database")


# ============ SONG REQUEST OPERATIONS ============

def get_pending_requests() -> List[Dict]:
    """Get all pending song requests."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM song_requests WHERE status = 'pending' ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_requests() -> List[Dict]:
    """Get all song requests."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM song_requests ORDER BY created_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_request(youtube_url: str, user_note: Optional[str] = None) -> Dict:
    """Create a new song request."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO song_requests (youtube_url, user_note)
        VALUES (?, ?)
    ''', (youtube_url, user_note))

    request_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {'request_id': request_id, 'youtube_url': youtube_url,
            'user_note': user_note, 'status': 'pending'}


def update_request_status(request_id: int, status: str) -> bool:
    """Update the status of a request (pending/approved/rejected)."""
    if status not in ('pending', 'approved', 'rejected'):
        return False

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('UPDATE song_requests SET status = ? WHERE request_id = ?',
                   (status, request_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return updated


# ============ FULL SONG DATA ============

def get_song_with_routine(video_id: str) -> Optional[Dict]:
    """Get a song with its routine and parsed lyrics."""
    song = get_song(video_id)
    if not song:
        return None

    routine = get_routine(video_id)

    # Parse lyrics JSON
    lyrics = None
    if song.get('lyrics_json'):
        try:
            lyrics = json.loads(song['lyrics_json'])
        except json.JSONDecodeError:
            lyrics = None

    return {
        'song': song,
        'routine': routine,
        'lyrics': lyrics
    }


# Initialize database on import
if __name__ == '__main__':
    init_database()
    populate_default_moves()
    print("Database setup complete!")
