const axios = require('axios');

const PROVIDERS = {
    SPOTIFY: 'spotify',
    YOUTUBE: 'youtube'
};

const getProvider = (url) => {
    if (url.includes('spotify.com')) return PROVIDERS.SPOTIFY;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return PROVIDERS.YOUTUBE;
    return null;
};

const fetchSpotifyMetadata = async (url) => {
    try {
        const response = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
        return {
            title: response.data.title,
            artist: response.data.author_name || 'Spotify', // OEmbed might not return artist separate from title sometimes
            thumbnail: response.data.thumbnail_url,
            platform: PROVIDERS.SPOTIFY,
            originalUrl: url,
            // Extract ID from URL for embed
            id: url.split('/').pop().split('?')[0] // Basic extraction
        };
    } catch (error) {
        console.error('Spotify Metadata Error:', error.message);
        return null;
    }
};

const ytSearch = require('yt-search');

const fetchYoutubeMetadata = async (url) => {
    try {
        const videoId = extractYoutubeId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        const result = await ytSearch({ videoId });

        console.log(`DEBUG: Fetched metadata for ${videoId}. Duration: ${result.seconds}s`);

        return {
            title: result.title,
            artist: result.author.name,
            thumbnail: result.thumbnail,
            platform: PROVIDERS.YOUTUBE,
            originalUrl: url,
            id: videoId,
            duration: result.seconds // Duration in seconds!
        };
    } catch (error) {
        console.error('YouTube Metadata Error:', error.message);
        // Fallback to oEmbed if yt-search fails (rare but possible) or just return null
        return null;
    }
};

const extractYoutubeId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const fetchMetadata = async (url) => {
    const provider = getProvider(url);
    if (!provider) return null;

    if (provider === PROVIDERS.SPOTIFY) {
        return await fetchSpotifyMetadata(url);
    } else if (provider === PROVIDERS.YOUTUBE) {
        return await fetchYoutubeMetadata(url);
    }
    return null;
};

module.exports = {
    fetchMetadata,
    PROVIDERS
};
