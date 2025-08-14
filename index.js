const express = require("express");
const cors = require("cors");
const { AuthorizationCode } = require("simple-oauth2");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for your Vercel domain
app.use(
  cors({
    origin: ["http://localhost:5173", "https://legendsfc.vercel.app"],
    credentials: true,
  })
);

// GitHub OAuth configuration
const oauth2 = new AuthorizationCode({
  client: {
    id: process.env.GITHUB_CLIENT_ID,
    secret: process.env.GITHUB_CLIENT_SECRET,
  },
  auth: {
    tokenHost: "https://github.com",
    tokenPath: "/login/oauth/access_token",
    authorizePath: "/login/oauth/authorize",
  },
});

// Auth endpoint - redirects to GitHub
app.get("/auth", (req, res) => {
  const authorizationUri = oauth2.authorizeURL({
    redirect_uri: `https://${req.get("host")}/callback`, // Force HTTPS
    scope: "repo,user",
    state: Math.random().toString(36).substring(7),
  });
  res.redirect(authorizationUri);
});

// Callback endpoint - handles GitHub response
app.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not found");
  }

  try {
    // Use direct fetch instead of simple-oauth2
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `https://${req.get("host")}/callback`,
          grant_type: "authorization_code",
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const token = tokenData.access_token;

    console.log("Token received:", token ? "present" : "missing");

    // Match the exact postMessage format that works
    res.send(`
        <script>
          if (window.opener) {
            window.opener.postMessage(
              'authorization:github:success:{"token":"${token}","provider":"github"}',
              '*'
            );
            window.close();
          }
        </script>
        <p>Authorization successful! This window should close automatically.</p>
      `);
  } catch (error) {
    console.error("OAuth error:", error);
    res.status(500).send("OAuth error occurred");
  }
});

app.get("/", (req, res) => {
  res.send("Decap CMS OAuth Proxy is running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
