// generateToken.js
import jwt from "jsonwebtoken";

// Replace with your actual credentials from https://app.videosdk.live/
const API_KEY = "f30ea6c0-c6c8-475c-afac-679a7b780b54";
const SECRET = "a8a3680b285afeb615c115b9dfbdd3a26fad23aedbae71b5893bb39cc2966ec7";

// Payload with full permissions
const payload = {
  apikey: API_KEY,
  permissions: ["allow_join", "allow_mod", "allow_live_stream"],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 *7, // valid 24 hours
};

// Create the JWT token
const token = jwt.sign(payload, SECRET);

console.log("✅ Your full-permission token:\n");
console.log(token);
