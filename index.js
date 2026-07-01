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

app.get("/search", async (req, res) => {
    const searchResults = await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&key=" + process.env.API_KEY + "&q=" + req.query.term)
        .then(res => res.json())
        .catch(_ => console.log("Error"))
    res.json({
        results: searchResults
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
