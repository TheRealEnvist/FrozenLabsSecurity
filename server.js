const http = require('http');

const hostname = '0.0.0.0'; // Your server address (localhost)
const port = process.env.PORT || 4000; // Your server port
var serverRequestStatus = {}

async function getRequest(url) {
    try {
        const response = await fetch(url, {
            mode: 'cors' // Ensure CORS mode
        });
        if (!response.ok) {
            const errorData = await response.json(); // Attempt to parse the error response
            throw { status: response.status, data: errorData };
        }
        const data = await response.json(); // Parse the JSON response
        data.status = response.status
        return data;
    } catch (error) {
        console.error('GET request failed:', error);
        return { message: 'An error occurred', status: error.status || 'unknown' };
    }
}

// Function for POST request
async function postRequest(url, payload) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors', // Ensure CORS mode
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json(); // Attempt to parse the error response
            throw { status: response.status, data: errorData };
        }
        const data = await response.json(); // Parse the JSON response
        data.status = response.status
        return data;
    } catch (error) {
        console.error('POST request failed:', error);
        return { message: 'An error occurred', status: error.status || 'unknown' };
    }
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Allowed methods
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allowed headers

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204); // No content
        res.end();
        return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    const myResponse = {};

    if (url.pathname === "/status") {
        myResponse.status = true;
    }

    if (url.pathname.includes("/games/")) {
        if (url.pathname.includes("/servers")) {
            const gameID = url.pathname.replace("/games/", "").substring(0, url.pathname.replace("/games/", "").indexOf("/servers"));
            if(gameID == ""){
                return
            }
            const serverList = await getRequest("https://games.roblox.com/v1/games/"+gameID+"/servers/0?sortOrder=2&excludeFullGames=false&limit=100");
            if(!serverList["data"]){
                serverList["data"] = []
            }
            console.log(serverList["status"]);
            myResponse.gameID = gameID;
            myResponse.status = serverList["status"];
            myResponse.servers = serverList["data"];
        }
        if (url.pathname.includes("/server/")) {
            const gameID = url.pathname.replace("/games/", "").substring(0, url.pathname.replace("/games/", "").indexOf("/server/"));
            var serverID = url.pathname.substring(url.pathname.indexOf("/server/")+ ("/server/").length,url.pathname.length).replace("/serverRequests", "");
            if (url.pathname.includes("/server/")) {                if(req.method == "POST"){
                    const jsonbody = req.body.json();
                    if(serverRequestStatus[gameID] == null){
                        serverRequestStatus[gameID] = {}
                        myResponse.createdNewGameProfile = true
                    }else{
                        myResponse.createdNewGameProfile = false
                    }
                    if(serverRequestStatus[gameID][serverID] == null){
                        serverRequestStatus[gameID][serverID] = {}
                        myResponse.createdNewServerProfile = true
                    }else{
                        myResponse.createdNewServerProfile = false
                    }
                    serverRequestStatus[gameID][serverID].requestingPlayers = jsonbody.requestingPlayers
                    myResponse.requestingPlayers = jsonbody.requestingPlayers
                }
                if(req.method == "GET"){
                    myResponse.status = "Still making api"
                    myResponse.serverID = serverID
                }
            }
        }
    }

    res.end(JSON.stringify(myResponse));
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
