const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(bodyParser.json());
app.use(cors());

const serverRequestStatus = {};
const serverPlayers = {};
const chatMessages = [];

async function getRequest(url, nocors) {
  try {
    const response = await fetch(url, {
      mode: nocors ? 'no-cors' : 'cors'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    const data = await response.json();
    data.status = response.status;
    return data;
  } catch (error) {
    console.error('GET request failed:', error);
    return { message: 'An error occurred', status: error.status || 'unknown' };
  }
}

async function postRequest(url, payload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw { status: response.status, data: errorData };
    }

    const data = await response.json();
    data.status = response.status;
    return data;
  } catch (error) {
    console.error('POST request failed:', error);
    return { message: 'An error occurred', status: error.status || 'unknown' };
  }
}

// Endpoint to handle chat messages
app.post('/games/:gameID/server/:serverID/chat', (req, res) => {
  const { gameID, serverID } = req.params;
  const { username, message } = req.body;

  if (!username || !message) {
    return res.status(400).send('Username and message are required.');
  }

  const chatEntry = { gameID, serverID, username, message, timestamp: new Date().toISOString() };
  chatMessages.push(chatEntry);
  io.emit('chat-message', chatEntry);
  res.status(200).send('Message received and broadcasted.');
});

app.get('/games/:gameID/server/:serverID/chat', (req, res) => {
  const { gameID, serverID } = req.params;
  const filteredMessages = chatMessages.filter(
    (msg) => msg.gameID === gameID && msg.serverID === serverID
  );
  res.json(filteredMessages);
});

app.post('/games/:gameID/server/:serverID/requests', (req, res) => {
  const { gameID, serverID } = req.params;
  const { requestingPlayers } = req.body;

  if (!serverRequestStatus[gameID]) {
    serverRequestStatus[gameID] = {};
  }

  if (!serverRequestStatus[gameID][serverID]) {
    serverRequestStatus[gameID][serverID] = {};
  }

  serverRequestStatus[gameID][serverID].requestingPlayers = requestingPlayers;
  res.json({ gameID, serverID, requestingPlayers });
});

app.get('/games/:gameID/server/:serverID/requests', (req, res) => {
  const { gameID, serverID } = req.params;

  if (!serverRequestStatus[gameID] || !serverRequestStatus[gameID][serverID]) {
    return res.json({ requestingPlayers: null });
  }

  res.json({
    requestingPlayers: serverRequestStatus[gameID][serverID].requestingPlayers
  });
});

app.post('/games/:gameID/server/:serverID/players', (req, res) => {
  const { gameID, serverID } = req.params;
  const { players } = req.body;

  if (!serverPlayers[gameID]) {
    serverPlayers[gameID] = {};
  }

  if (!serverPlayers[gameID][serverID]) {
    serverPlayers[gameID][serverID] = {};
  }

  serverPlayers[gameID][serverID].players = players;
  serverPlayers[gameID][serverID].lastUpdated = Date.now();

  res.json({ players, lastUpdated: serverPlayers[gameID][serverID].lastUpdated });
});

app.get('/games/:gameID/server/:serverID/players', (req, res) => {
  const { gameID, serverID } = req.params;

  if (!serverPlayers[gameID] || !serverPlayers[gameID][serverID]) {
    return res.json({ players: [], lastUpdated: 0 });
  }

  res.json({
    players: serverPlayers[gameID][serverID].players,
    lastUpdated: serverPlayers[gameID][serverID].lastUpdated
  });
});

// Endpoint for player headshots
app.get('/games/:gameID/server/:serverID/playerHeadshots', async (req, res) => {
  const { gameID, serverID } = req.params;

  if (!serverPlayers[gameID] || !serverPlayers[gameID][serverID]) {
    return res.json({ headshots: [] });
  }

  const players = serverPlayers[gameID][serverID].players || [];
  const playerIds = players.map((player) => player.UserID).join(',');

  try {
    const headshots = await getRequest(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${playerIds}&size=50x50&format=Png&isCircular=false`,
      false
    );

    res.json({ headshots: headshots.data || [] });
  } catch (error) {
    console.error('Error fetching player headshots:', error);
    res.status(500).json({ error: 'Failed to fetch player headshots.' });
  }
});

// WebSocket setup
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.emit('chat-history', chatMessages);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
