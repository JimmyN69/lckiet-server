const { randomBytes, randomInt } = require("node:crypto");

module.exports = function setupDice(dice) {
    // Each lobby stores its players and most recent roll.
    const lobbies = new Map();

    function updateLobby(id) {
        const lobby = lobbies.get(id);
        if (!lobby) return;

        dice.to(id).emit("lobbyUpdated", {
            id,
            players: [...lobby.players.values()],
            lastRoll: lobby.lastRoll
        });
    }

    function leaveLobby(socket) {
        const id = socket.data.lobbyId;
        if (!id) return;

        socket.leave(id);
        delete socket.data.lobbyId;

        const lobby = lobbies.get(id);
        if (!lobby) return;

        lobby.players.delete(socket.id);

        if (lobby.players.size === 0) {
            lobbies.delete(id);
        } else {
            updateLobby(id);
        }
    }

    function validName(name) {
        return typeof name === "string"
            && name.trim().length >= 1
            && name.trim().length <= 24;
    }

    dice.on("connection", (socket) => {
        console.log("Dice player connected:", socket.id);

        function sendError(message) {
            socket.emit("lobbyError", message);
        }

        socket.on("createLobby", (data) => {
            if (socket.data.lobbyId) {
                return sendError("Leave your current lobby first.");
            }

            if (!validName(data?.name)) {
                return sendError("Enter a name with 1–24 characters.");
            }

            let id;

            do {
                id = randomBytes(3).toString("hex").toUpperCase();
            } while (lobbies.has(id));

            lobbies.set(id, {
                players: new Map([[socket.id, data.name.trim()]]),
                lastRoll: null
            });

            socket.data.lobbyId = id;
            socket.join(id);
            updateLobby(id);
        });

        socket.on("joinLobby", (data) => {
            if (socket.data.lobbyId) {
                return sendError("Leave your current lobby first.");
            }

            if (!validName(data?.name)) {
                return sendError("Enter a name with 1–24 characters.");
            }

            const id = typeof data?.lobbyId === "string"
                ? data.lobbyId.trim().toUpperCase()
                : "";

            const lobby = lobbies.get(id);

            if (!lobby) {
                return sendError("That lobby does not exist.");
            }

            if (lobby.players.size >= 16) {
                return sendError("This lobby is full.");
            }

            lobby.players.set(socket.id, data.name.trim());

            socket.data.lobbyId = id;
            socket.join(id);
            updateLobby(id);
        });

        socket.on("rollDice", (data) => {
            const id = socket.data.lobbyId;
            const lobby = lobbies.get(id);

            if (!lobby || !lobby.players.has(socket.id)) {
                return sendError("Join a lobby first.");
            }

            const count = data?.count;
            const sides = data?.sides;

            if (
                !Number.isInteger(count) || count < 1 || count > 20 ||
                !Number.isInteger(sides) || sides < 2 || sides > 1000
            ) {
                return sendError("Use 1–20 dice with 2–1000 sides.");
            }

            const now = Date.now();

            if (now - (socket.data.lastRollAt || 0) < 500) {
                return sendError("Wait a moment before rolling again.");
            }

            socket.data.lastRollAt = now;

            const rolls = Array.from(
                { length: count },
                () => randomInt(1, sides + 1)
            );

            lobby.lastRoll = {
                name: lobby.players.get(socket.id),
                sides,
                rolls,
                total: rolls.reduce((sum, value) => sum + value, 0)
            };

            updateLobby(id);
        });

        socket.on("leaveLobby", () => {
            leaveLobby(socket);
            socket.emit("lobbyLeft");
        });

        socket.on("disconnect", () => {
            leaveLobby(socket);
            console.log("Dice player disconnected:", socket.id);
        });
    });
};