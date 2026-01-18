const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));
// Serve node_modules as /vendor for frontend libraries
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules')));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'front.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});



