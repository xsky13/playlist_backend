const express = require("express");
const cors = require("cors");
require('dotenv').config()
const youtubedl = require('youtube-dl-exec')
const path = require('path');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { spawn } = require('child_process');

const cookiesPath = path.join(__dirname, 'cookies.txt');

const app = express();
app.use(express.json());

app.use(cors({
	origin: 'https://xsky13.github.io',
	// origin: 'http://localhost:5173',
	optionsSuccessStatus: 200
}));

function parseISO8601Duration(duration) {
	const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
	if (!match) return null;
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

function estimateFilesize(durationSeconds, bitrateKbps = 128) {
	return Math.round((durationSeconds * bitrateKbps * 1000) / 8);
}

app.post("/extract", async (req, res) => {
	try {
		const url = req.body.url;
		const videoId = new URL(url).searchParams.get("v");
		if (!videoId) return res.status(400).json({ error: "Invalid video URL" });

		const detailsRes = await fetch(
			`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${process.env.API_KEY}`
		);
		const detailsData = await detailsRes.json();
		const video = detailsData.items?.[0];

		if (!video) return res.status(404).json({ error: "Video not found" });

		const isoDuration = video.contentDetails.duration;
		const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
		const totalSeconds = match
			? (parseInt(match[1] || "0", 10) * 3600) + (parseInt(match[2] || "0", 10) * 60) + parseInt(match[3] || "0", 10)
			: 0;

		res.json({
			id: videoId,
			title: video.snippet.title,
			channel: video.snippet.channelTitle,
			duration: parseISO8601Duration(isoDuration),
			filesize: estimateFilesize(totalSeconds)
		});
	} catch (error) {
		console.error("Extract Error:", error);
		res.status(500).json({ error: "Failed to fetch video details" });
	}
});

const jsRuntimePath = process.env.DENO_PATH || 'deno';

// app.get("/extract/:id", async (req, res) => {
//     const url = `https://youtube.com/watch?v=${req.params.id}`;
//     const process = youtubedl.exec(url, {
//         extractAudio: true,
//         audioFormat: "mp3",
//         audioQuality: "128K",
//         output: "-",
//         cookies: cookiesPath,
//         ffmpegLocation: ffmpeg.path,
//         extractorArgs: 'youtube:player-client=web;player-skip=web_safari,tv_downgraded',
//         jsRuntimes: `deno:${jsRuntimePath}`,
//         remoteComponents: 'ejs:github'
//     });
//     res.setHeader("Content-Type", "audio/mpeg");
//     process.stdout.pipe(res);
// })
//

// app.get("/extract/:id", async (req, res) => {
// 	const url = `https://youtube.com/watch?v=${req.params.id}`;

// 	const ytdlp = youtubedl.exec(url, {
// 		format: 'bestaudio/best',
// 		output: '-',
// 		cookies: cookiesPath,
// 		extractorArgs: 'youtube:player-client=web,android',
// 		jsRuntimes: `deno:${jsRuntimePath}`,
// 		remoteComponents: 'ejs:github'
// 	});

// 	const ffmpegProcess = spawn(ffmpeg.path, [
// 		'-i', 'pipe:0',
// 		'-vn',
// 		'-acodec', 'libmp3lame',
// 		'-b:a', '128k',
// 		'-f', 'mp3',
// 		'pipe:1'
// 	]);

// 	let headersSent = false;

// 	ytdlp.stdout.pipe(ffmpegProcess.stdin);

// 	ffmpegProcess.stdout.once('data', () => {
// 		if (!headersSent) {
// 			res.setHeader('Content-Type', 'audio/mpeg');
// 			headersSent = true;
// 		}
// 	});
// 	ffmpegProcess.stdout.pipe(res);

// 	let ytdlpStderr = '';
// 	let ffmpegStderr = '';
// 	ytdlp.stderr.on('data', (c) => { ytdlpStderr += c.toString(); });
// 	ffmpegProcess.stderr.on('data', (c) => { ffmpegStderr += c.toString(); });

// 	const failIfNoHeaders = (source, message) => {
// 		console.error(`${source} failed for ${req.params.id}:`, message);
// 		if (!headersSent && !res.headersSent) {
// 			res.status(502).json({ error: "Failed to extract audio, try again" });
// 		}
// 	};

// 	ytdlp.on('exit', (code) => {
// 		if (code !== 0) failIfNoHeaders('yt-dlp', ytdlpStderr);
// 	});
// 	ffmpegProcess.on('exit', (code) => {
// 		if (code !== 0) failIfNoHeaders('ffmpeg', ffmpegStderr);
// 	});
// 	ytdlp.on('error', (err) => failIfNoHeaders('yt-dlp', err));
// 	ffmpegProcess.on('error', (err) => failIfNoHeaders('ffmpeg', err));
// });

const fs = require('fs');
const os = require('os');

app.get("/extract/:id", async (req, res) => {
    const url = `https://youtube.com/watch?v=${req.params.id}`;
    const rawTemplate = path.join(os.tmpdir(), `${req.params.id}-raw.%(ext)s`);

    try {
        await youtubedl(url, {
            format: 'bestaudio/best',
            output: rawTemplate,
            cookies: cookiesPath,
            extractorArgs: 'youtube:player-client=web,android',
            jsRuntimes: `deno:${jsRuntimePath}`,
            remoteComponents: 'ejs:github'
        });

        const dir = os.tmpdir();
        const match = fs.readdirSync(dir).find(f => f.startsWith(`${req.params.id}-raw.`));
        if (!match) throw new Error("Downloaded file not found");
        const rawPath = path.join(dir, match);

        const ffmpegProcess = spawn(ffmpeg.path, [
            '-i', rawPath,
            '-vn',
            '-acodec', 'libmp3lame',
            '-b:a', '128k',
            '-f', 'mp3',
            'pipe:1'
        ]);

        res.setHeader('Content-Type', 'audio/mpeg');
        ffmpegProcess.stdout.pipe(res);

        let ffmpegStderr = '';
        ffmpegProcess.stderr.on('data', c => { ffmpegStderr += c.toString(); });

        ffmpegProcess.on('exit', (code) => {
            fs.unlink(rawPath, () => {});
            if (code !== 0 && !res.headersSent) {
                console.error(`ffmpeg failed for ${req.params.id}:`, ffmpegStderr);
                res.status(502).json({ error: "Failed to extract audio, try again" });
            }
        });
        ffmpegProcess.on('error', (err) => {
            fs.unlink(rawPath, () => {});
            if (!res.headersSent) {
                console.error(`ffmpeg spawn error for ${req.params.id}:`, err);
                res.status(502).json({ error: "Failed to extract audio, try again" });
            }
        });
    } catch (error) {
        console.error(`Extract Error for ${req.params.id}:`, error);
        if (!res.headersSent) {
            res.status(502).json({ error: "Failed to extract audio, try again" });
        }
    }
});

app.listen(8080, () => {
	console.log("App listening on port 8080")
})
