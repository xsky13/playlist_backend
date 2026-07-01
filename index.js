const express = require("express");
const cors = require("cors");
require('dotenv').config()
const youtubedl = require('youtube-dl-exec')

const app = express();
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200
}));

function parseISO8601Duration(duration) {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const mm = Math.floor(totalSeconds / 60);
    const ss = String(totalSeconds % 60).padStart(2, "0");
    return hours > 0
        ? `${hours}:${String(mm % 60).padStart(2, "0")}:${ss}`
        : `${mm}:${ss}`;
}

app.get("/search", async (req, res) => {
    const searchResults = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${req.query.term}&key=${process.env.API_KEY}`)
    const searchData = await searchResults.json();

    const videoIds = searchData.items
        .map(item => item.id.videoId)
        .filter(Boolean)
        .join(",");

    if (!videoIds) return res.json({ results: [] });

    const detailsResults = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${process.env.API_KEY}`)
    const detailsData = await detailsResults.json();

    const durationById = {};
    detailsData.items.forEach(item => {
        durationById[item.id] = parseISO8601Duration(item.contentDetails.duration);
    });

    const results = searchData.items.map(item => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails?.default?.url,
        duration: durationById[item.id.videoId] ?? null
    }));

    res.json({
        results
    })
});

app.post("/extract", async (req, res) => {
    const url = req.body.url;

    const info = await youtubedl(url, {
        dumpSingleJson: true
    });

    res.json({
        id: info.id,
        title: info.title,
        duration: info.duration_string,
        channel: info.channel,
        filesize: info.filesize || info.filesize_approx
    });
});

app.get("/extract/:id", async (req, res) => {
    const url = `https://youtube.com/watch?v=${req.params.id}`;

    const process = youtubedl.exec(url, {
        extractAudio: true,
        audioFormat: "mp3",
        output: "-"
    });

    res.setHeader("Content-Type", "audio/mpeg");
    process.stdout.pipe(res);
})

app.listen(8080, () => {
    console.log("App listening on port 8080")
})
