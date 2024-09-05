const express = require("express"); // getting the express library
const bcrypt = require("bcrypt"); // bcrypt is used for hashing the password before storage
const connection = require("../db/connect"); // connect.js is what links to the database
const jwt = require("jsonwebtoken"); // jwt provides a token each time the user logs or signs in
const authentication = require("../middleware/auth"); //

const userRouter = express.Router();

// route to sign up
userRouter.post("/signedup", async (req, res) => {
  const { first_name, last_name, username, email, password } = req.body;

  connection.query(
    "SELECT * FROM Users WHERE email = ? OR username = ?",
    [email, username],
    async (err, results) => {
      if (results.length > 0) {
        return res
          .status(400)
          .json({ message: "Username or email already exists" });
      }

      const password_hash = await bcrypt.hash(password, 10); // 10 is the salt round value that determines how complex the password will be

      // insert a new member
      connection.query(
        "INSERT INTO Users (first_name, last_name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)",
        [first_name, last_name, username, email, password_hash],
        (err, results) => {
          if (err) throw err;

          const token = jwt.sign(
            { id: results.insertId },
            "your_jwt_secret_key",
            { expiresIn: "1h" } // user will have to login again after 1hr
          );

          res.status(201).json({ message: "User ceated", token });
        }
      );
    }
  );
});

userRouter.post("/signup", async (req, res) => {
  const { first_name, last_name, username, email, password } = req.body;

  try {
    // Check if email or username already exists
    connection.query(
      "SELECT * FROM Users WHERE email = ? OR username = ?",
      [email, username],
      async (err, results) => {
        if (err) {
          return res.status(500).json({ message: "Database error", error: err });
        }
        
        if (results.length > 0) {
          return res
            .status(400)
            .json({ message: "Username or email already exists" });
        }

        // Hash the password
        const password_hash = await bcrypt.hash(password, 10); // 10 is the salt round value that determines complexity

        // Insert a new user into the database
        connection.query(
          "INSERT INTO Users (first_name, last_name, username, email, password_hash) VALUES (?, ?, ?, ?, ?)",
          [first_name, last_name, username, email, password_hash],
          (err, results) => {
            if (err) {
              return res.status(500).json({ message: "Error creating user", error: err });
            }

            // Generate a JWT token
            const token = jwt.sign(
              { id: results.insertId },
              process.env.JWT_SECRET || "your_jwt_secret_key", // Use environment variable for JWT secret
              { expiresIn: "1h" }
            );

            return res.status(201).json({ message: "User created", token });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = userRouter;

// route to login user
userRouter.post("/login", (req, res) => {
  const { email, password } = req.body;

  connection.query(
    "SELECT * FROM Users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) throw err;

      if (results.length === 0) {
        return res.status(400).json({ message: "User not found" });
      }

      const user = results[0];

      const match = await bcrypt.compare(password, user.password_hash);

      if (!match) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id }, "your_jwt_secret_key", {
        expiresIn: "1h",
      });

      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          firstname: user.first_name,
          lastname: user.last_name,
          username: user.username,
          email: user.email,
        },
      });
    }
  );
});

userRouter.get("/search", async (req, res) => {
  const searchQuery = req.query.q;
  const userId = req.query.userId;

  if (!searchQuery) {
    return res.status(400).json({ message: "Search query is required" });
  }

  try {
    const [users] = await connection.promise().query(
      "SELECT u.id, u.first_name, u.last_name, u.username, " +
        "COALESCE(fr1.status, fr2.status) AS requestStatus, " +
        "CASE WHEN fr1.id IS NOT NULL THEN 'received' WHEN fr2.id IS NOT NULL THEN 'sent' ELSE 'none' END AS requestType " +
        "FROM Users u " +
        "LEFT JOIN FriendRequests fr1 ON fr1.sender_id = u.id AND fr1.receiver_id = ? " + // Requests sent to the current user
        "LEFT JOIN FriendRequests fr2 ON fr2.receiver_id = u.id AND fr2.sender_id = ? " + // Requests sent by the current user
        "WHERE u.username LIKE ? AND u.id != ?",
      [userId, userId, `${searchQuery}%`, userId]
    );

    // console.log(users);
    const filteredUsers = users.filter((user) => {
      if (user.requestType === "received" && user.requestStatus === "pending") {
        return false;
      }
      return true;
    });

    res.status(200).json(filteredUsers);
  } catch (err) {
    console.error("Error searching for users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

userRouter.post("/friend-request/send", (req, res) => {
  const { sender_id, receiver_id } = req.body;

  if (!sender_id || !receiver_id) {
    return res
      .status(400)
      .json({ message: "Sender and Receiver ids are required" });
  }

  connection.query(
    `SELECT * FROM FriendRequests 
     WHERE (sender_id = ? AND receiver_id = ?) 
     OR (sender_id = ? AND receiver_id = ?)`,
    [sender_id, receiver_id, receiver_id, sender_id],
    (err, results) => {
      if (err) {
        console.error("Error checking friend request:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (results.length > 0) {
        return res.status(400).json({
          message: "Friend request already exists between these users.",
        });
      }

      connection.query(
        "INSERT INTO FriendRequests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')",
        [sender_id, receiver_id],
        (err, result) => {
          if (err) {
            console.error("Error sending friend request:", err);
            return res.status(500).json({ message: "Internal server error" });
          }

          res.status(201).json({ message: "Friend request sent successfully" });
        }
      );
    }
  );
});

userRouter.post("/check-friend-request", (req, res) => {
  const { sender_id, receiver_id } = req.body;

  if (!sender_id || !receiver_id) {
    return res
      .status(400)
      .json({ message: "Sender and receiver IDs are required" });
  }

  connection.query(
    "SELECT * FROM FriendRequests WHERE sender_id = ? AND receiver_id = ? AND status = 'pending'",
    [sender_id, receiver_id],

    (err, results) => {
      if (err) {
        console.error("Error checking friend request:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (results.length > 0) {
        return res.status(200).json({ exists: true });
      } else {
        return res.status(200).json({ exists: false });
      }
    }
  );
});

userRouter.get("/friend-requests/:userId", (req, res) => {
  const { userId } = req.params;

  connection.query(
    `SELECT fr.id AS request_id, u.id, u.first_name, u.last_name, u.username 
     FROM FriendRequests fr 
     JOIN Users u ON fr.sender_id = u.id 
     WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
    [userId],
    (err, results) => {
      if (err) {
        console.error("Error retrieving friend requests:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      res.status(200).json(results);
    }
  );
});

userRouter.post("/friend-request/accept", (req, res) => {
  const { requestId } = req.body;

  connection.query(
    "UPDATE FriendRequests SET status = 'accepted' WHERE id = ?",
    [requestId],
    (err, result) => {
      if (err) {
        console.error("Error accepting friend request:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      res.status(200).json({ message: "Friend request accepted" });
    }
  );
});

userRouter.post("/friend-request/reject", (req, res) => {
  const { requestId } = req.body;

  connection.query(
    "UPDATE FriendRequests SET status = 'rejected' WHERE id = ?",
    [requestId],
    (err, result) => {
      if (err) {
        console.error("Error rejecting friend request:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      res.status(200).json({ message: "Friend request rejected" });
    }
  );
});

userRouter.get("/profile", authentication, (req, res) => {
  connection.query(
    "SELECT id, first_name, last_name, username, email, created_at FROM users WHERE id = ?",
    [req.user.id],
    (err, results) => {
      if (err) {
        return res.status(500).json({
          message: "Server error",
        });
      }

      if (results.length === 0) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      res.status(200).json(results[0]);
    }
  );
  res.json({ message: "This is your profile", user: req.user });
});

module.exports = userRouter;
