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
const ServerChats = {};

const VaildTokens = {};

// Private:
// App: 

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

async function postRequest(url, payload, options = { contentType: 'application/json' }) {
  try {
    let body;
    const headers = { 'Content-Type': options.contentType };

    if (options.contentType === 'application/json') {
      body = JSON.stringify(payload);
    } else if (options.contentType === 'application/x-www-form-urlencoded') {
      body = new URLSearchParams(payload).toString();
    } else {
      throw new Error('Unsupported content type');
    }

    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers,
      body,
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

async function RefreshTokenToAccess(token){
    return await postRequest("https://apis.roblox.com/oauth/v1/token", {
      ["refresh_token"]: token,
      ["grant_type"]: "refresh_token",
      ["client_id"]: "1027663679860863056",
      ["client_secret"]: "RBX-gTrSwFIOikmYDaWRZ6F4x_8Ne2zF5wyUsrZa1_EsqRLwbORcliwevszHUesW8kup"
    },{ contentType: 'application/x-www-form-urlencoded' });
}

async function TokenInformation(token){
  return await postRequest("https://apis.roblox.com/oauth/v1/token/introspect", {
    ["token"]: token,
    ["client_id"]: "1027663679860863056",
    ["client_secret"]: "RBX-gTrSwFIOikmYDaWRZ6F4x_8Ne2zF5wyUsrZa1_EsqRLwbORcliwevszHUesW8kup"
  },{ contentType: 'application/x-www-form-urlencoded' });
}

async function TokenResources(token){
  return await postRequest("https://apis.roblox.com/oauth/v1/token/resources", {
    ["token"]: token,
    ["client_id"]: "1027663679860863056",
    ["client_secret"]: "RBX-gTrSwFIOikmYDaWRZ6F4x_8Ne2zF5wyUsrZa1_EsqRLwbORcliwevszHUesW8kup"
  },{ contentType: 'application/x-www-form-urlencoded' });
}


async function fetchWithRetry(url, maxRetries = 5, retries = 0, delayBetweenRequests = 10) {
  try {
    // Add a delay before retrying if applicable
    if (delayBetweenRequests > 0 && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests * 1000));
    }

    const response = await fetch(url);

    // Check if the response is successful (2xx)
    if (response.ok) {
      return response; // Return the successful response
    }

    // Handle 429 Too Many Requests
    if (response.status === 429 && retries < maxRetries) {
      const retryAfter = response.headers.get('retry-after')
        ? parseInt(response.headers.get('retry-after')) * 1000
        : 2 ** retries * 100; // Fallback to exponential backoff
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return fetchWithRetry(url, maxRetries, retries + 1, delayBetweenRequests);
    }

    // If it's a non-retryable error or retries are exceeded, throw an error
    if (retries >= maxRetries) {
      throw new Error(`Max retries reached. HTTP status: ${response.status}`);
    }

    // Retry for other non-successful statuses (e.g., 500)
    console.warn(`Received HTTP ${response.status}, retrying... (attempt ${retries + 1})`);
    await new Promise(resolve => setTimeout(resolve, 2 ** retries * 100));
    return fetchWithRetry(url, maxRetries, retries + 1, delayBetweenRequests);

  } catch (error) {
    // Catch and retry for network-related errors
    if (retries < maxRetries) {
      const retryAfter = 2 ** retries * 100; // Exponential backoff
      console.warn(`Error encountered, retrying after ${retryAfter}ms (attempt ${retries + 1}):`, error);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
      return fetchWithRetry(url, maxRetries, retries + 1, delayBetweenRequests);
    } else {
      throw error; // Propagate the error if retries are exceeded
    }
  }
}




function findInList(list, key, value) {
    if (!Array.isArray(list)) {
        throw new Error("The first argument must be an array.");
    }
    return list.find(item => item[key] === value) || null;
}

app.get('/profile/:code/access', async (req, res) => {
  const { code } = req.params;


  if(VaildTokens[code] == true){
    const tokens = RefreshTokenToAccess(code)
    delete VaildTokens[code]
    VaildTokens[tokens["refresh_token"]] = true
    res.status(200).json({verified:  true, token: await tokens["access_token"], ["refresh-token"]: tokens["refresh_token"]});
  }else{
    res.status(Verifing["status"]).json({ verified:  false});
  }
});

app.get('/thumbnails/:id/', async (req, res) => {
  const { id } = req.params;

  try {
    const mediaResponse = await fetchWithRetry(
      `https://thumbnails.roblox.com/v1/assets?assetIds=${id}&returnPolicy=PlaceHolder&size=768x432&format=Png&isCircular=false`, 
      10, 0, 5
    );
    const Media = await mediaResponse.json();

    // Send the parsed data as JSON
    res.status(200).json({ Media: Media });
  } catch (error) {
    console.error('Error fetching Information:', error);
    res.status(500).json({ error: 'Failed to fetch Information.' });
  }
});

app.get('/universe/:UniverseID/information', async (req, res) => {
  const { UniverseID } = req.params;

  try {
    // Fetch and parse Media
    const mediaResponse = await fetchWithRetry(
      `https://games.roblox.com/v2/games/${UniverseID}/media?fetchAllExperienceRelatedMedia=false`, 
      10, 0, 5
    );
    const Media = await mediaResponse.json();

    // Fetch and parse Root
    const rootResponse = await fetchWithRetry(
      `https://games.roblox.com/v1/games?universeIds=${UniverseID}`, 
      10, 0, 5
    );
    const Root = await rootResponse.json();

    // Send the parsed data as JSON
    res.status(200).json({ RootPlace: Root, Media: Media });
  } catch (error) {
    console.error('Error fetching Information:', error);
    res.status(500).json({ error: 'Failed to fetch Information.' });
  }
});

app.get('/profile/:code/register', async (req, res) => {
  const { code } = req.params;

    if(code != null){
      const Verifing = await postRequest("https://apis.roblox.com/oauth/v1/token", {
        ["code"]: code,
        ["grant_type"]: "authorization_code",
        ["client_id"]: "1027663679860863056",
        ["client_secret"]: "RBX-gTrSwFIOikmYDaWRZ6F4x_8Ne2zF5wyUsrZa1_EsqRLwbORcliwevszHUesW8kup"
      },{ contentType: 'application/x-www-form-urlencoded' });
      if(Verifing["status"] == 200){
        VaildTokens[Verifing["refresh_token"]] = true
        res.status(200).json({verified:  true, token: Verifing["refresh_token"], ["token-information"]: await TokenInformation(Verifing["access_token"]), ["token-resources"]: await TokenResources(Verifing["access_token"])});
      }else{
        res.status(Verifing["status"]).json({ verified:  false});
      }
    }

});

// Endpoint to handle chat messages
app.post('/games/:gameID/server/:serverID/chat', (req, res) => {
  const { gameID, serverID } = req.params;
  const { username, display, message} = req.body;

  if (!username || !display || !message) {
    return res.status(400).send('Username, Display and message are required.');
  }

  if(!ServerChats[gameID]){
    ServerChats[gameID] = {}
  }
  if(!ServerChats[gameID][serverID]){
    ServerChats[gameID][serverID] = [];
  }

  const chatEntry = {username, display, message, timestamp: new Date().toISOString() };
  ServerChats[gameID][serverID].unshift(chatEntry)
  io.of(`/games/${gameID}/server/${serverID}/chat-server`).emit('chat-message', chatEntry);
  res.status(200).send('Message received and broadcasted.');
});

app.post('/games/:gameID/server/:serverID/server-chat', (req, res) => {
  const { gameID, serverID } = req.params;
  const { messageID, add, message} = req.body;

  if (!messageID && !add) {
    return res.status(400).send('Message ID Required');
  }

  if(!ServerChats[gameID]){
    ServerChats[gameID] = {}
  }
  if(!ServerChats[gameID][serverID+"_ServerChats"]){
    ServerChats[gameID][serverID+"_ServerChats"] = {};
  }


  if(!add){
    delete ServerChats[gameID][serverID+"_ServerChats"][messageID];
    res.status(200).send('Message deleted.');
  }else{
    ServerChats[gameID][serverID+"_ServerChats"][Object.keys(ServerChats[gameID][serverID+"_ServerChats"]).length+1] = message;
    res.status(200).send('Message Added.');
  }
});

app.get('/games/:gameID/server/:serverID/register-server-chat', (req, res) => {
  const { gameID, serverID } = req.params;
  io.of(`/games/${gameID}/server/${serverID}/chat-server`).emit('chat-message',{Message:"Registered"})
  res.status(200).send('Registered');
});

app.get('/games/:gameID/server/:serverID/server-chats', (req, res) => {
  const { gameID, serverID } = req.params;
  if(!ServerChats[gameID]){
    ServerChats[gameID] = {}
  }
  if(!ServerChats[gameID][serverID+"_ServerChats"]){
    ServerChats[gameID][serverID+"_ServerChats"] = {};
  }
  res.json({
    ["Messages"]:  ServerChats[gameID][serverID+"_ServerChats"]
  });
});

app.get('/games/:gameID/server/:serverID/chat', (req, res) => {
  const { gameID, serverID } = req.params;
  if(!ServerChats[gameID]){
    ServerChats[gameID] = {}
  }
  if(!ServerChats[gameID][serverID]){
    ServerChats[gameID][serverID] = [];
  }
  res.json({
    ["Messages"]:  ServerChats[gameID][serverID]
  });
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

    var editedHeadshots = headshots.data

    headshots.data.forEach((data, index, array) => {
        const userdata = findInList(players, "UserID", data["targetId"])
        editedHeadshots[index]["PlayerInformation"] = userdata
    });

    res.json({ headshots: editedHeadshots || [] });
  } catch (error) {
    console.error('Error fetching player headshots:', error);
    res.status(500).json({ error: 'Failed to fetch player headshots.' });
  }
});

app.get('/status', (req, res) => {
  res.json({ status: true });
});

app.get('/games/:gameID/servers', async (req, res) => {
  const { gameID } = req.params;

  try {
    const serverListResponse = await fetchWithRetry(
      `https://games.roblox.com/v1/games/${gameID}/servers/0?sortOrder=2&excludeFullGames=false&limit=100`,10
    );

    const serverList = await serverListResponse.json();

    res.json({
      gameID,
      status: serverListResponse.status,
      servers: serverList || [],
    });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers.' });
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


