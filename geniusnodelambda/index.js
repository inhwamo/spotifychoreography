const axios = require('axios');
const { parse } = require('node-html-parser');

async function searchLyricsUrl(artist, title) {
  const accessToken = "ZRq5TE0jeu-lC2jdTBA40Bk7Jm_pNglRrhS0n5_pWGw-QWfnjH02D3lvdD2zJIc2";
  const searchQuery = `${title} ${artist}`;
  const response = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(searchQuery)}&access_token=${accessToken}`);
  const data = response.data;

  if (data.response.hits.length > 0) {
    return data.response.hits[0].result.url;
  } else {
    throw new Error("No lyrics found");
  }
}

async function fetchLyrics(url) {
  const response = await axios.get(url);
  const html = response.data;
  const root = parse(html);
  const lyrics = root.querySelector('.lyrics').innerText.trim();
  return lyrics;
}

exports.handler = async (event) => {
  const { artist, title } = JSON.parse(event.body);
  
  try {
    const lyricsUrl = await searchLyricsUrl(artist, title);
    const lyrics = await fetchLyrics(lyricsUrl);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lyrics }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
