const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

app.use(express.json());

// Attach socket.io
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    const areaVendors = {};
    //join user room
    socket.on("join_user", ({ userId }) => {
        const room = `user_${userId}`;
        socket.join(room);
        console.log(`👤 User ${userId} joined room: ${room}`);
        socket.emit("message", `You are in room ${room}`);
    });
    //leave user room
    socket.on("leave_user", ({ userId }) => {
        const room = `user_${userId}`;
        socket.leave(room);
        console.log(`👤 User ${userId} left room: ${room}`);
    });
    //join vendor room
    socket.on("join_vendor", ({ vendorId }) => {
        const room = `vendor_${vendorId}`;
        socket.join(room);
        console.log(`🏪 Vendor ${vendorId} joined room: ${room}`);
        socket.emit("message", `You are in room ${room}`);
    });
    //leave vendor room
    socket.on("leave_vendor", ({ vendorId }) => {
        const room = `vendor_${vendorId}`;
        socket.leave(room);
        console.log(`🏪 Vendor ${vendorId} left room: ${room}`);
    });
    // to broadcast in a specific area
    socket.on("join_vendor_area", ({ vendorId, areaCode }) => {
        const areaRoom = `area_${areaCode}`;
        socket.join(areaRoom);
        console.log(`🏪 Vendor ${vendorId} joined area: ${areaRoom}`);

        // store vendor info in the area for filtering
        if (!areaVendors[areaRoom]) areaVendors[areaRoom] = {};
        areaVendors[areaRoom][vendorId] = socket.id;
    });

    socket.on("leave_vendor_area", ({ vendorId, areaCode }) => {
        const areaRoom = `area_${areaCode}`;
        socket.leave(areaRoom);
        console.log(`🌍 Vendor ${vendorId} left area: ${areaRoom}`);

        if (areaVendors[areaRoom]) delete areaVendors[areaRoom][vendorId];
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

// Api for backend to send command to a specific user
app.post("/notify-user", (req, res) => {
    const { userId, event, data } = req.body;
    const room = `user_${userId}`;
    console.log(`📩 Emitting '${event}' to ${room}`);
    io.to(room).emit(event, data);
    res.json({ success: true });
});

// Api for backend to send command to a specific vendor
app.post("/notify-vendor", (req, res) => {
    const { vendorId, event, data } = req.body;
    const room = `vendor_${vendorId}`;
    console.log(`📩 Emitting '${event}' to ${room}`);
    io.to(room).emit(event, data);
    res.json({ success: true });
});

// Api for backend to broadcast to a specific area
app.post("/notify-specific-vendors-in-area", (req, res) => {
    const { areaCode, vendorIds, event, data } = req.body;
    const areaRoom = `area_${areaCode}`;

    if (!areaVendors[areaRoom]) return res.json({ success: false, message: "No vendors in this area" });
    let sentCount = 0;
    vendorIds.forEach(vendorId => {
        const socketId = areaVendors[areaRoom][vendorId];
        if (socketId) {
            io.to(socketId).emit(event, data);
            sentCount++;
            console.log(`📩 Sent '${event}' to vendor ${vendorId} in area ${areaCode}`);
        }
    });

    res.json({ success: true, sentTo: sentCount });
});

// Start server
server.listen(3001, () => {
    console.log("🚀 Socket.IO server running on port 3001");
});
