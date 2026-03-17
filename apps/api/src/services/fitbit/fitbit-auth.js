const fetch = require("node-fetch");
const { db } = require("../../firestore");

const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";

function getBasicAuthHeader() {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;

  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

async function refreshAccessToken(patientId, refreshToken) {
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const response = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fitbit refresh error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // 🔁 Save updated tokens back to Firestore
  const expiresAt = new Date(
    Date.now() + data.expires_in * 1000
  ).toISOString();

  const patientRef = db().collection("patients").doc(patientId);

  await patientRef.set(
    {
      fitbit: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        lastRefreshAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );

  return data.access_token;
}

module.exports = { refreshAccessToken };