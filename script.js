// Getting DOM elements
const form = document.getElementById('song-search-form');
const albumArtContainer = document.getElementById('albumArtContainer');
const searchingText = document.getElementById('searchingText');
const songInfoElement = document.getElementById('song-info');

document.addEventListener('DOMContentLoaded', function() {
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setRatingContainersVisible(false);
        const songName = document.getElementById('song-name').value;

        // Show searching text and disable the button
        searchingText.style.display = 'block';
        form.querySelector('button').disabled = true;

        await searchSong(songName);

        // Hide searching text and enable the button after a delay
        searchingText.style.display = 'none';
        setTimeout(() => {
            form.querySelector('button').disabled = false;
        }, 5000);
    });
});

//Spotify API
async function getAccessToken() {
    const now = new Date().getTime();
    const storedToken = localStorage.getItem('accessToken');
    const storedExpiration = localStorage.getItem('tokenExpiration');

    // Check if the token is stored and still valid
    if (storedToken && storedExpiration && now < parseInt(storedExpiration)) {
        console.log('Using stored access token:', storedToken);
        return storedToken;
    }

    // Either no token or expired token, need to fetch a new one
    console.log('Getting a new access token...');
    const response = await fetch('https://d2k708hnw9.execute-api.ca-central-1.amazonaws.com/prod/accesstoken', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();
    if (data.access_token) {
        console.log('Access token:', data.access_token);
        const expiration = now + 3600 * 1000; // Current time + 1 hour in milliseconds
        localStorage.setItem('accessToken', data.access_token);
        localStorage.setItem('tokenExpiration', expiration);
        return data.access_token;
    } else {
        throw new Error('Access token not received');
    }
}

// Searches song then updates the HTML content
async function searchSong(songName) {
    const accessToken = await getAccessToken();

    // Search for the song
    const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(songName)}&type=track&limit=1`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const searchData = await searchResponse.json();
    const track = searchData.tracks.items[0];
    console.log('Track found:', track);

    // Fetch the album to get the genres
    console.log('Fetching album data...');
    const albumResponse = await fetch(track.album.href, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const albumData = await albumResponse.json();
    console.log('Album data:', albumData);

    // Get the artist name and genres
    const artistName = track.artists[0].name;
    const genres = albumData.genres;
    const imageUrl = track.album.images[0].url;
    const albumName = track.album.name;
    const trackName = track.name;
    const releaseDate = track.album.release_date;

    const trackId = track.id;
    const audioFeatures = await fetchAudioFeatures(accessToken, trackId);

    // Update the HTML content
    console.log('Updating HTML content...');
    albumArtContainer.innerHTML = `<img src="${imageUrl}" alt="Album Art", style="width: 300px; height: 300px;">`;

    try {
        const lyrics = await fetchLyrics(artistName, trackName, "-PSQ4tLFW6U4I7Q3RQE_4_d-RzpAgvXb7PLBmJNGMtHYuVpyXQEGDna1Dq9dL4uC");
        console.log("Lyrics:", lyrics);
        songInfoElement.innerHTML += `<div class="lyrics-container"><pre>${lyrics}</pre></div>`;
    } catch (error) {
        console.error("Error fetching lyrics:", error.message);
    }
    console.log('Audio Features:', audioFeatures);


    songInfoElement.innerHTML = `
        <p>Artist: ${artistName}</p>
        <p>Album: ${albumName}</p>
        <p>Track: ${trackName}</p>
        <p>Release Date: ${releaseDate}</p>
        <p>Genres: ${genres.join(', ') || 'N/A'}</p>
        <p>Tempo: ${audioFeatures.tempo}</p>
        <p>Key: ${audioFeatures.key}</p>
        <p>Time Signature: ${audioFeatures.time_signature}</p>
        <p>Danceability: ${audioFeatures.danceability}</p>
        <p>Energy: ${audioFeatures.energy}</p>
        <p>Loudness: ${audioFeatures.loudness}</p>
        <p>Speechiness: ${audioFeatures.speechiness}</p>
        <p>Acousticness: ${audioFeatures.acousticness}</p>
        <p>Instrumentalness: ${audioFeatures.instrumentalness}</p>
        <p>Liveness: ${audioFeatures.liveness}</p>
        <p>Valence: ${audioFeatures.valence}</p>
    `;
    updateAudioFeatures(audioFeatures);
    setRatingContainersVisible(true);

    updateDanceabilityBar(audioFeatures.danceability);
    updateEnergyBar(audioFeatures.energy);
    updateValenceBar(audioFeatures.valence);

    document.getElementById('audio-features').style.display = 'block';

  
    console.log('HTML content updated');

}

// Function to fetch lyrics using Genius API
// Not working: Genius makes it hard to scrape lyrics
async function fetchLyrics(artist, title, accessToken) {
    const searchQuery = `${title} ${artist}`;
    const response = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(
            searchQuery
        )}&access_token=${accessToken}`
    );
    const data = await response.json();

    let lyricsUrl;

    if (data.response.hits.length > 0) {
        lyricsUrl = data.response.hits[0].result.url;
    } else {
        throw new Error("No lyrics found");
    }

    const apiGatewayUrl = "https://nxxfbjjkth.execute-api.ca-central-1.amazonaws.com/prod/geniuslyrics";

    const lyricsResponse = await fetch(apiGatewayUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: lyricsUrl })
    });

    const lyricsData = await lyricsResponse.json();
    const lyrics = lyricsData.lyrics || 'Lyrics not found';

    return lyrics;
}

async function fetchAudioFeatures(accessToken, trackId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const audioFeatures = await response.json();
        const { tempo, key, time_signature, danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence } = audioFeatures;
        return { tempo, key, time_signature, danceability, energy, loudness, speechiness, acousticness, instrumentalness, liveness, valence };
    } catch (error) {
        console.error('Error fetching audio features:', error.message);
        throw error;
    }
}
function updateAudioFeatures(audioFeatures) {
    // Update the danceability progress bar
    const danceabilityNormalized = audioFeatures.danceability;
    document.getElementById('danceability').value = danceabilityNormalized;
    document.getElementById('danceability-value').textContent = danceabilityNormalized.toFixed(2);
  
    // Add other audio features here, following the same pattern
  }
  
function setRatingContainersVisible(visible) {
    const ratingContainers = document.getElementById('ratingContainers');
    ratingContainers.style.display = visible ? 'block' : 'none';
  }
  

function convertToScale(value) {
    return Math.ceil(value * 5);
  }
function updateDanceabilityBar(danceability) {
    const scaleValue = convertToScale(danceability);
    const container = document.getElementById('danceabilityContainer');
    const ratingElements = container.querySelectorAll('.rating-element');
  
    ratingElements.forEach((element, index) => {
      if (index < scaleValue) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
    });
  }
function updateEnergyBar(value) {
    const scaleValue = convertToScale(energy);
    const container = document.getElementById('energyContainer');
    const ratingElements = container.querySelectorAll('.rating-element');
    updateRatingContainer(container, value);

    ratingElements.forEach((element, index) => {
        if (index < scaleValue) {
          element.classList.add('active');
        } else {
          element.classList.remove('active');
        }
      });
  }
  
function updateValenceBar(value) {
    const scaleValue = convertToScale(valence);
    const container = document.getElementById('valenceContainer');
    const ratingElements = container.querySelectorAll('.rating-element');

    ratingElements.forEach((element, index) => {
        if (index < scaleValue) {
          element.classList.add('active');
        } else {
          element.classList.remove('active');
        }
      });  
}
  