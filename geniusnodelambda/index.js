const axios = require('axios');
const { parse } = require('node-html-parser');

async function fetchLyrics(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const root = parse(html);
    const lyrics = root.querySelector('.lyrics').innerText.trim();
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
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
