const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization || "";
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!match) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not configured.");
        return res.status(500).json({
            message: "Server authentication is not configured."
        });
    }

    try {
        req.user = jwt.verify(match[1], process.env.JWT_SECRET);
        return next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired login."
        });
    }
}

function requireRole(role, message) {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            return res.status(403).json({
                message: message || "Access denied."
            });
        }

        return next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};
