const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) return res.sendStatus(403);

    jwt.verify(token, 'your_jwt_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

module.exports = authenticateToken;
