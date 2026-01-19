// Dance Card Generator - Database Module (localStorage)

const DB_KEY = 'dance_card_routines';
const DB_VERSION = 1;

// Database Schema:
// {
//   youtubeId: string,
//   title: string,
//   artist: string,
//   choreography: {
//     songVibe: string,
//     estimatedBPM: number,
//     moves: Array<{ moveId, beats, startTime }>
//   },
//   lyrics: string | null,
//   createdAt: number (timestamp),
//   updatedAt: number (timestamp)
// }

class ChoreographyDB {
    constructor() {
        this.cache = this._loadFromStorage();
    }

    // Load all routines from localStorage
    _loadFromStorage() {
        try {
            const data = localStorage.getItem(DB_KEY);
            if (!data) return {};

            const parsed = JSON.parse(data);
            // Handle version migrations if needed
            if (parsed._version !== DB_VERSION) {
                return this._migrate(parsed);
            }
            return parsed.routines || {};
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return {};
        }
    }

    // Save to localStorage
    _saveToStorage() {
        try {
            const data = {
                _version: DB_VERSION,
                routines: this.cache
            };
            localStorage.setItem(DB_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                this._cleanup();
                try {
                    localStorage.setItem(DB_KEY, JSON.stringify({
                        _version: DB_VERSION,
                        routines: this.cache
                    }));
                } catch (e) {
                    console.error('Still cannot save after cleanup:', e);
                }
            }
        }
    }

    // Migrate old data format
    _migrate(oldData) {
        // For now, just return empty if format doesn't match
        console.log('Migrating database from old format');
        return oldData.routines || {};
    }

    // Cleanup old entries if storage is full
    _cleanup() {
        const entries = Object.entries(this.cache);
        if (entries.length === 0) return;

        // Sort by createdAt and remove oldest 20%
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
        const toRemove = Math.max(1, Math.floor(entries.length * 0.2));

        for (let i = 0; i < toRemove; i++) {
            delete this.cache[entries[i][0]];
        }

        console.log(`Cleaned up ${toRemove} old routines`);
    }

    // Check if a routine exists for a video
    has(youtubeId) {
        return youtubeId in this.cache;
    }

    // Get a routine by YouTube ID
    get(youtubeId) {
        return this.cache[youtubeId] || null;
    }

    // Save a new routine
    save(youtubeId, data) {
        const now = Date.now();
        const existing = this.cache[youtubeId];

        this.cache[youtubeId] = {
            youtubeId,
            title: data.title,
            artist: data.artist,
            choreography: data.choreography,
            lyrics: data.lyrics || null,
            createdAt: existing?.createdAt || now,
            updatedAt: now
        };

        this._saveToStorage();
        return this.cache[youtubeId];
    }

    // Update lyrics for an existing routine
    updateLyrics(youtubeId, lyrics) {
        if (!this.cache[youtubeId]) return false;

        this.cache[youtubeId].lyrics = lyrics;
        this.cache[youtubeId].updatedAt = Date.now();
        this._saveToStorage();
        return true;
    }

    // Delete a routine
    delete(youtubeId) {
        if (!this.cache[youtubeId]) return false;

        delete this.cache[youtubeId];
        this._saveToStorage();
        return true;
    }

    // Get all saved routines
    getAll() {
        return Object.values(this.cache).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    // Get count of saved routines
    count() {
        return Object.keys(this.cache).length;
    }

    // Clear all data
    clear() {
        this.cache = {};
        this._saveToStorage();
    }

    // Get storage stats
    getStats() {
        const dataStr = localStorage.getItem(DB_KEY) || '';
        return {
            count: this.count(),
            sizeBytes: new Blob([dataStr]).size,
            sizeKB: (new Blob([dataStr]).size / 1024).toFixed(2)
        };
    }
}

// Lyrics/Transcription Service using local Whisper backend
const LyricsService = {
    // Backend API base URL
    API_BASE: 'http://localhost:5000',

    // Transcribe audio from YouTube video using Whisper
    async transcribe(videoId, force = false) {
        try {
            const response = await fetch(`${this.API_BASE}/api/transcribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ videoId, force })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Transcription failed');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Transcription error:', error);
            throw error;
        }
    },

    // Check if transcription is cached on server
    async checkCache(videoId) {
        try {
            const response = await fetch(`${this.API_BASE}/api/cache/${videoId}`);
            const data = await response.json();
            return data.cached ? data : null;
        } catch (error) {
            return null;
        }
    },

    // Main fetch function - gets transcription with timestamps
    async fetch(videoId) {
        return await this.transcribe(videoId);
    },

    // Format segments for display with timestamp data attributes
    formatSegments(segments) {
        if (!segments || segments.length === 0) return null;

        return segments.map((segment, index) => {
            const text = escapeHtml(segment.text);
            return `<p class="lyrics-line" data-index="${index}" data-start="${segment.start}" data-end="${segment.end}">${text}</p>`;
        }).join('');
    },

    // Format full text (fallback without timestamps)
    format(lyricsData) {
        if (!lyricsData) return null;

        // If we have segments, use those for timestamps
        if (lyricsData.segments && lyricsData.segments.length > 0) {
            return this.formatSegments(lyricsData.segments);
        }

        // Fallback to plain text
        if (lyricsData.text) {
            const lines = lyricsData.text.split('\n');
            return lines.map((line, index) => {
                if (line.trim() === '') {
                    return '<div class="lyrics-break"></div>';
                }
                return `<p class="lyrics-line" data-index="${index}">${escapeHtml(line)}</p>`;
            }).join('');
        }

        return null;
    }
};

// Helper to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Create global instance
window.choreographyDB = new ChoreographyDB();
window.LyricsService = LyricsService;

// Export for debugging
window.debugDB = {
    db: window.choreographyDB,
    getStats: () => window.choreographyDB.getStats(),
    getAll: () => window.choreographyDB.getAll(),
    clear: () => window.choreographyDB.clear()
};
