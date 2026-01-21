const yts = require('yt-search');
const { PROVIDERS } = require('./metadata');

const searchYoutube = async (query) => {
    try {
        const r = await yts(query);
        if (!r || !r.videos) {
            console.error('yt-search returned invalid data');
            return [];
        }
        const videos = r.videos.slice(0, 10); // Top 10 results

        return videos.map(v => ({
            title: v.title,
            artist: v.author?.name || 'Unknown',
            thumbnail: v.thumbnail,
            platform: PROVIDERS.YOUTUBE,
            originalUrl: v.url,
            id: v.videoId,
            duration: v.timestamp
        }));
    } catch (err) {
        console.error("Search Error:", err);
        return [];
    }
};

module.exports = { searchYoutube };
