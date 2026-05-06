const express = require("express");
const { exec } = require("child_process");

const app = express();
app.use(express.json());

app.use('/output', express.static('output'));

app.post("/render", (req, res) => {
    const { id, platform, slides, template = "dark" } = req.body;

    const data = JSON.stringify(slides);

    const command = `node scripts/carousel.js --id "${id}" --platform "${platform}" --template "${template}" --data '${data}'`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: stderr });
        }

        const baseUrl = "http://render-service:3000";
        const jsonMatch = stdout.match(/\{.*\}/s);
        let urls = [];

        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);

                urls = (parsed.slides || []).map(p =>
                    p.replace('/app/', baseUrl + '/')
                );
            } catch (e) {
                console.error("Error parsing JSON:", e);
            }
        }

        res.json({
            success: true,
            urls
        });
    });
});

app.listen(3000, () => {
    console.log("🚀 Render API running on port 3000");
});