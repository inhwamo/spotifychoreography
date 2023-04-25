document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('song-search-form');
    const albumArtContainer = document.getElementById('albumArtContainer');
    const searchingText = document.getElementById('searchingText');
    const songInfoElement = document.getElementById('song-info');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
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
async function getAccessToken() {
    const now = new Date().getTime();
    const storedToken = localStorage.getItem('accessToken');
    const storedExpiration = localStorage.getItem('tokenExpiration');

    // Check if the token is stored and still valid
    if (storedToken && storedExpiration && now < parseInt(storedExpiration)) {
        console.log('Using stored access token:', storedToken);
        return storedToken;
    }

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


async function searchSong(songName) {
    const songInfoElement = document.getElementById('song-info');
    console.log('Searching for the song...');
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
    // Update the HTML content
    console.log('Updating HTML content...');
    albumArtContainer.innerHTML = `<img src="${imageUrl}" alt="Album Art", style="width: 300px; height: 300px;">`;

    songInfoElement.innerHTML = `
        <p>Artist: ${artistName}</p>
        <p>Album: ${albumName}</p>
        <p>Track: ${trackName}</p>
        <p>Release Date: ${releaseDate}</p>
        <p>Genres: ${genres.join(', ') || 'N/A'}</p>
    `;
    console.log('HTML content updated');

}