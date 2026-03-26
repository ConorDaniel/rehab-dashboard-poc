const fetch = require("node-fetch");

const FITBIT_API_BASE = "https://api.fitbit.com/1";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function fitbitGet(path, accessToken) {
  if (!accessToken) {
    throw new Error("Missing Fitbit access token");
  }

  const response = await fetch(`${FITBIT_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fitbit API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function getStepsIntradayToday(accessToken) {
  const date = getTodayDateString();
  const path = `/user/-/activities/steps/date/${date}/${date}/1min.json`;
  return fitbitGet(path, accessToken);
}

async function getHeartRateDailyToday(accessToken) {
  const date = getTodayDateString();
  const path = `/user/-/activities/heart/date/${date}/1d.json`;
  return fitbitGet(path, accessToken);
}

function extractRestingHeartRate(data) {
  return data?.["activities-heart"]?.[0]?.value?.restingHeartRate ?? null;
}

module.exports = {
  getStepsIntradayToday,
  getHeartRateDailyToday,
  extractRestingHeartRate,
};