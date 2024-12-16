const express = require('express');
const https = require('https');
const fs = require('fs');

const app = express();

// Serve static files
app.use(express.static('public')); // Adjust the path as per your folder structure

// HTTPS server setup (optional, for local testing)
const options = {
    key: fs.readFileSync('./192.168.1.112+2-key.pem'),
    cert: fs.readFileSync('./192.168.1.112+2.pem')
};

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
