const axios = require('axios');
const { parse } = require('node-html-parser');

async function fetchLyrics(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    console.log('Fetched HTML content:', html); // Add this line to log the HTML content
    const root = parse(html);
    const lyricsElement = root.querySelector('.lyrics');
    
    if (!lyricsElement) {
      throw new Error('Lyrics element not found in the HTML content');
    }

    const lyrics = lyricsElement.innerText.trim();
    return lyrics;
  } catch (error) {
    console.error('Error fetching lyrics:', error.message);
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    const lyrics = await fetchLyrics(event.url);
    return {
      statusCode: 200,
      body: JSON.stringify({ lyrics }),
      headers: {
        'Access-Control-Allow-Origin': '*', // Add this line to include the necessary header
        'Content-Type': 'application/json'
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: {
        'Access-Control-Allow-Origin': '*', // Add this line to include the necessary header
        'Content-Type': 'application/json'
      }
    };
  }
};
