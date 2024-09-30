const express = require("express");
const connection = require("../db/connect");

const messageRouter = express.Router();

messageRouter.post("/send-message", async (req, res) => {
  const { conversation_id, sender_id, receiver_id, message_text } = req.body;

  if (!conversation_id) {
    return res.status(400).json({ message: "missing conversation Id" });
  }
  if (!sender_id) {
    return res.status(400).json({ message: "missing sender Id" });
  }
  if (!receiver_id) {
    return res.status(400).json({ message: "missing receiver Id" });
  }
  if (!message_text) {
    return res.status(400).json({ message: "missing message text" });
  }

  try {
    const [result] = await connection
      .promise()
      .query(
        "INSERT INTO ConversationMessages (conversation_id, sender_id, receiver_id, message_text) VALUES (?, ?, ?, ?)",
        [conversation_id, sender_id, receiver_id, message_text]
      );

    res
      .status(201)
      .json({ message: "message sent", messageId: result.insertId });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ message: "Server error" });
  }
});

messageRouter.get("/get-message/:conversation_id", async (req, res) => {
  const { conversation_id } = req.params;

  if (!conversation_id) {
    return res.status(400).json({ message: "Conversation ID is required" });
  }

  try {
    const [messages] = await connection
      .promise()
      .query(
        "SELECT * FROM ConversationMessages WHERE conversation_id = ? ORDER BY timestamp ASC",
        [conversation_id]
      );

    res.status(200).json(messages);
  } catch (err) {}
});

messageRouter.get("/get-latest-message/:user_id", async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ message: "Conversation ID is required" });
  }

  try {
    const [messages] = await connection.promise().query(
      `SELECT 
        Cm.id, 
        Cm.conversation_id, 
        Cm.sender_id, 
        Cm.receiver_id, 
        Cm.message_text, 
        Cm.timestamp, 
        U.first_name, 
        U.last_name, 
        U.username 
      FROM 
          ConversationMessages Cm 
      JOIN 
        users U 
      ON ( 
          (Cm.sender_id = U.id AND Cm.sender_id != ?) 
          OR 
          (Cm.receiver_id != ? AND Cm.receiver_id = U.id)
        ) 
      WHERE 
      sender_id = ? OR receiver_id = ?
      ORDER BY timestamp DESC LIMIT 1000;`,
      [user_id, user_id, user_id, user_id]
    );

    res.status(200).json(messages.reverse()); // Reversing to get the messages in ascending order
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = messageRouter;
