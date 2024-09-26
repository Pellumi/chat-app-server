const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connection = require("./db/connect");
const app = express();

const PORT = process.env.PORT || 3003;

const userRouter = require("./routes/userRouter");
const conversationRouter = require("./routes/conversationRouter");
const messageRouter = require("./routes/messageRouter");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.13.9:5173",
      "http://172.33.144.1:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());

app.use("/api/users", userRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/messages", messageRouter);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("send-message", (message) => {
    io.emit("receive-message", message);
  });

  socket.on("send-request", (request) => {
    io.emit("receive-request", request);
  });

  socket.on("send-convo", (convo) => {
    io.emit("receive-convo", convo);
  });

  socket.on("disconnect", () => {
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port: ${PORT}`);
});
