// Add an event listener for form submission
const form = document.getElementById("song-search-form");
const albumArtContainer = document.getElementById("albumArtContainer");
const searchingText = document.getElementById("searchingText");
const songInfoElement = document.getElementById("song-info");

document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("song-search-form");
    const albumArtContainer = document.getElementById("albumArtContainer");
    const searchingText = document.getElementById("searchingText");
    const songInfoElement = document.getElementById("song-info");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const songName = document.getElementById("song-name").value;

        // Show searching text and disable the button
        searchingText.style.display = "block";
        form.querySelector("button").disabled = true;

        await searchSong(songName);

        // Hide searching text and enable the button after a delay
        searchingText.style.display = "none";
        setTimeout(() => {
            form.querySelector("button").disabled = false;
        }, 5000);
    });
});

async function getAccessToken() {
    console.log("Getting access token...");
    const response = await fetch("https://d2k708hnw9.execute-api.ca-central-1.amazonaws.com/prod/accesstoken", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const data = await response.json();
    if (data.access_token) {
        console.log("Access token:", data.access_token);
        return data.access_token;
    } else {
        throw new Error("Access token not received");
    }
}

async function searchSong(songName) {
    console.log("Searching for the song...");
    const accessToken = await getAccessToken();

    // Search for the song
    const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(songName)}&type=track&limit=1`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
    });
    const searchData = await searchResponse.json();
    const track = searchData.tracks.items[0];
    console.log("Track found:", track);

    // Fetch the album
}
