const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
    res.render('client');
});

app.get('/admin', (req, res) => {
    res.render('admin');
});

app.post('/generate-config', (req, res) => {
    const config = req.body;
    // Generate YAML/JS configuration file
    res.json({ success: true, config });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});