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


def migrate_lyrics_to_separate_table(cursor):
    """Migrate lyrics_json from songs table to separate lyrics table."""
    # Check if there's data to migrate
    cursor.execute('''
        SELECT video_id, lyrics_json FROM songs
        WHERE lyrics_json IS NOT NULL AND lyrics_json != ''
    ''')
    songs_with_lyrics = cursor.fetchall()

    for row in songs_with_lyrics:
        video_id = row[0]
        lyrics_json = row[1]

        # Check if already migrated
        cursor.execute('SELECT video_id FROM lyrics WHERE video_id = ?', (video_id,))
        if cursor.fetchone():
            continue  # Already migrated

        # Parse the old lyrics format and extract segments
        try:
            lyrics_data = json.loads(lyrics_json)
            # Handle different formats
            if isinstance(lyrics_data, dict) and 'segments' in lyrics_data:
                segments = lyrics_data['segments']
                structure = lyrics_data.get('structure')
            elif isinstance(lyrics_data, list):
                segments = lyrics_data
                structure = None
            else:
                segments = []
                structure = None

            # Insert into lyrics table
            cursor.execute('''
                INSERT INTO lyrics (video_id, segments_json, structure_json, last_edited)
                VALUES (?, ?, ?, ?)
            ''', (video_id, json.dumps(segments),
                  json.dumps(structure) if structure else None,
                  datetime.now().isoformat()))

        except (json.JSONDecodeError, TypeError):
            pass  # Skip invalid data


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

    # Lyrics table - stores lyrics separately (ONE per song, manually editable)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lyrics (
            video_id TEXT PRIMARY KEY,
            segments_json TEXT NOT NULL,
            structure_json TEXT,
            last_edited TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES songs(video_id)
        )
    ''')

    # Routines table - choreography sequences for songs (MANY per song)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS routines (
            routine_id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            version_name TEXT DEFAULT 'Original',
            move_sequence_json TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (video_id) REFERENCES songs(video_id)
        )
    ''')

    # Add version_name and is_default columns if they don't exist (migration)
    try:
        cursor.execute('ALTER TABLE routines ADD COLUMN version_name TEXT DEFAULT "Original"')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE routines ADD COLUMN is_default INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass

    # Migrate existing lyrics from songs table to lyrics table
    migrate_lyrics_to_separate_table(cursor)

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


# ============ LYRICS OPERATIONS ============

def get_lyrics(video_id: str) -> Optional[Dict]:
    """Get lyrics for a song from the separate lyrics table."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM lyrics WHERE video_id = ?', (video_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        result = dict(row)
        # Parse JSON fields
        if result.get('segments_json'):
            result['segments'] = json.loads(result['segments_json'])
        if result.get('structure_json'):
            result['structure'] = json.loads(result['structure_json'])
        return result
    return None


def save_lyrics(video_id: str, segments: List[Dict],
                structure: Optional[Dict] = None) -> Dict:
    """Save lyrics for a song (separate from choreography)."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT OR REPLACE INTO lyrics (video_id, segments_json, structure_json, last_edited)
        VALUES (?, ?, ?, ?)
    ''', (video_id, json.dumps(segments),
          json.dumps(structure) if structure else None,
          datetime.now().isoformat()))

    conn.commit()
    conn.close()

    return get_lyrics(video_id)


def update_lyrics_timestamps(video_id: str, segments: List[Dict]) -> Optional[Dict]:
    """Update just the timestamps/text in lyrics (preserves structure)."""
    existing = get_lyrics(video_id)
    if not existing:
        # Create new lyrics entry
        return save_lyrics(video_id, segments)

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE lyrics SET segments_json = ?, last_edited = ?
        WHERE video_id = ?
    ''', (json.dumps(segments), datetime.now().isoformat(), video_id))

    conn.commit()
    conn.close()

    return get_lyrics(video_id)


# ============ ROUTINE OPERATIONS ============

def get_routine(video_id: str, routine_id: Optional[int] = None) -> Optional[Dict]:
    """Get a routine for a song (default or specific by ID)."""
    conn = get_connection()
    cursor = conn.cursor()

    if routine_id:
        cursor.execute('SELECT * FROM routines WHERE routine_id = ?', (routine_id,))
    else:
        # Get default routine, or most recent if no default
        cursor.execute('''
            SELECT * FROM routines WHERE video_id = ?
            ORDER BY is_default DESC, created_at DESC LIMIT 1
        ''', (video_id,))

    row = cursor.fetchone()
    conn.close()

    if row:
        result = dict(row)
        # Parse JSON fields
        if result.get('move_sequence_json'):
            result['moves'] = json.loads(result['move_sequence_json'])
        return result
    return None


def get_all_routines(video_id: str) -> List[Dict]:
    """Get all routines for a song."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM routines WHERE video_id = ?
        ORDER BY is_default DESC, created_at DESC
    ''', (video_id,))
    rows = cursor.fetchall()
    conn.close()

    routines = []
    for row in rows:
        result = dict(row)
        if result.get('move_sequence_json'):
            result['moves'] = json.loads(result['move_sequence_json'])
        routines.append(result)
    return routines


def save_routine(video_id: str, move_sequence: List[Dict],
                 version_name: str = 'Original', is_default: bool = False) -> Dict:
    """Save a new routine for a song (supports multiple versions)."""
    conn = get_connection()
    cursor = conn.cursor()

    # If this is set as default, unset other defaults
    if is_default:
        cursor.execute('UPDATE routines SET is_default = 0 WHERE video_id = ?', (video_id,))

    # Check if this is the first routine for this song
    cursor.execute('SELECT COUNT(*) FROM routines WHERE video_id = ?', (video_id,))
    is_first = cursor.fetchone()[0] == 0

    # Insert new routine
    cursor.execute('''
        INSERT INTO routines (video_id, version_name, move_sequence_json, is_default)
        VALUES (?, ?, ?, ?)
    ''', (video_id, version_name, json.dumps(move_sequence),
          1 if (is_default or is_first) else 0))

    routine_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return get_routine(video_id, routine_id)


def update_routine(routine_id: int, move_sequence: Optional[List[Dict]] = None,
                   version_name: Optional[str] = None, is_default: Optional[bool] = None) -> Optional[Dict]:
    """Update an existing routine."""
    conn = get_connection()
    cursor = conn.cursor()

    # Build update query dynamically
    updates = []
    values = []

    if move_sequence is not None:
        updates.append('move_sequence_json = ?')
        values.append(json.dumps(move_sequence))

    if version_name is not None:
        updates.append('version_name = ?')
        values.append(version_name)

    if is_default is not None:
        # If setting as default, unset others first
        if is_default:
            cursor.execute('''
                UPDATE routines SET is_default = 0
                WHERE video_id = (SELECT video_id FROM routines WHERE routine_id = ?)
            ''', (routine_id,))
        updates.append('is_default = ?')
        values.append(1 if is_default else 0)

    if not updates:
        conn.close()
        return get_routine(None, routine_id)

    values.append(routine_id)
    cursor.execute(f'''
        UPDATE routines SET {', '.join(updates)} WHERE routine_id = ?
    ''', values)

    conn.commit()
    conn.close()

    return get_routine(None, routine_id)


def delete_routine(routine_id: int) -> bool:
    """Delete a routine."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM routines WHERE routine_id = ?', (routine_id,))
    deleted = cursor.rowcount > 0

    conn.commit()
    conn.close()

    return deleted


def set_default_routine(routine_id: int) -> bool:
    """Set a routine as the default for its song."""
    conn = get_connection()
    cursor = conn.cursor()

    # Get video_id for this routine
    cursor.execute('SELECT video_id FROM routines WHERE routine_id = ?', (routine_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    video_id = row[0]

    # Unset all defaults for this song
    cursor.execute('UPDATE routines SET is_default = 0 WHERE video_id = ?', (video_id,))

    # Set this one as default
    cursor.execute('UPDATE routines SET is_default = 1 WHERE routine_id = ?', (routine_id,))

    conn.commit()
    conn.close()
    return True


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

def get_song_with_routine(video_id: str, routine_id: Optional[int] = None) -> Optional[Dict]:
    """Get a song with its lyrics and routine (from separate tables)."""
    song = get_song(video_id)
    if not song:
        return None

    # Get lyrics from separate table
    lyrics_data = get_lyrics(video_id)

    # Get routine (default or specified)
    routine = get_routine(video_id, routine_id)

    # Get all routines for this song
    all_routines = get_all_routines(video_id)

    # Build lyrics object
    lyrics = None
    structure = None
    if lyrics_data:
        lyrics = {'segments': lyrics_data.get('segments', [])}
        structure = lyrics_data.get('structure')

    return {
        'song': song,
        'routine': routine,
        'lyrics': lyrics,
        'structure': {'sections': structure} if structure else None,
        'all_routines': all_routines
    }


# Initialize database on import
if __name__ == '__main__':
    init_database()
    populate_default_moves()
    print("Database setup complete!")
