const express = require("express");
const { exec } = require("child_process");

const app = express();
app.use(express.json());

app.use('/output', express.static('output'));

app.post("/render", (req, res) => {
    const { id, platform, slides } = req.body;

    const data = JSON.stringify(slides);

    const command = `node scripts/carousel.js --id "${id}" --platform "${platform}" --data '${data}'`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr });
        }

        res.json({
            success: true,
            output: stdout
        });
    });
});

app.listen(3000, () => {
    console.log("🚀 Render API running on port 3000");
});