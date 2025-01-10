const http = require('http');

const hostname = '0.0.0.0'; // Your server address (localhost)
const port = process.env.PORT || 4000; // Your server port

async function getRequest(url) {
    try {
        const response = await fetch(url, {
            mode: 'cors' // Ensure CORS mode
        });
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json(); // Parse the JSON response        
        return data;
    } catch (error) {
        console.error('GET request failed:', error);
        return {};
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
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json(); // Parse the JSON response
        return data;
    } catch (error) {
        console.warn('POST request failed:', error);
        return {error: response.status};
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
            const serverList = await getRequest("https://games.roblox.com/v1/games/"+gameID+"/servers/0?sortOrder=2&excludeFullGames=false&limit=100");
            if(!serverList["data"]){
                serverList["data"] = []
                myResponse.error = serverList.error
            }
            myResponse.gameID = gameID;
            myResponse.servers = serverList["data"];
        }
        if (url.pathname.includes("/server/")) {

        }
    }

    res.end(JSON.stringify(myResponse));
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
