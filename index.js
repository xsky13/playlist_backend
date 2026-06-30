const express = require("express");
const cors = require("cors");
require('dotenv').config()

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200
}));

app.get("/search", async (req, res) => {
    const searchResults = await fetch("https://www.googleapis.com/youtube/v3/search?part=snippet&key=" + process.env.API_KEY + "&q=" + req.query.term)
        .then(res => res.json())
        .catch(_ => alert("Hubo un error"))
    res.json({
        results: searchResults
    })
})

app.listen(8080, () => {
    console.log("App listening on port 8080")
})
