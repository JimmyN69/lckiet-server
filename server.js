const express = require("express");
const http = require("node:http");
const { Server } = require("socket.io");
const setupDice = require("./games/dice");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "https://lckiet.com",
            "https://www.lckiet.com"
        ]
    }
});

app.get("/", (req, res) => {
    res.send("LCKiet game server is running!");
});

// Register each game here.
setupDice(io.of("/dice"));

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Game server running on port ${PORT}`);
});