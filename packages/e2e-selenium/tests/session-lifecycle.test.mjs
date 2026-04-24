import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(repoRoot, "apps/api/.env.local") });
dotenv.config({ path: path.join(repoRoot, "apps/mobile/.env") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase client env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

const defaultPassword = process.env.E2E_PASSWORD || "BiteBuddy123!";
const hostEmail = process.env.E2E_HOST_EMAIL || "e2e.host@bitebuddy.test";
const hostPassword = process.env.E2E_HOST_PASSWORD || defaultPassword;
const friendEmail = process.env.E2E_FRIEND_EMAIL || "e2e.friend@bitebuddy.test";
const friendPassword = process.env.E2E_FRIEND_PASSWORD || defaultPassword;

async function signInAndGetAccessToken(email, password) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session?.access_token) {
    throw new Error(
      `Unable to sign in ${email}: ${error?.message || "no session"}`,
    );
  }

  return data.session.access_token;
}

async function apiRequest(method, routePath, token, body) {
  const response = await fetch(`${apiUrl}${routePath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  return { status: response.status, json };
}

test("session lifecycle: waiting -> cancelled by host", async () => {
  const hostToken = await signInAndGetAccessToken(hostEmail, hostPassword);

  const created = await apiRequest("POST", "/api/sessions", hostToken, {
    name: `E2E Lifecycle ${Date.now()}`,
    latitude: 37.7749,
    longitude: -122.4194,
    radius_meters: 5000,
    category_filter: "restaurants",
  });

  assert.equal(
    created.status,
    201,
    `Expected session create status 201, got ${created.status} (${created.json.error || ""})`,
  );

  const sessionId = created.json.data?.id;
  assert.ok(sessionId, "Expected created session id");
  assert.equal(created.json.data?.status, "waiting");

  const cancelResponse = await apiRequest(
    "POST",
    `/api/sessions/${sessionId}/cancel`,
    hostToken,
  );
  assert.equal(
    cancelResponse.status,
    200,
    `Expected cancel status 200, got ${cancelResponse.status} (${cancelResponse.json.error || ""})`,
  );

  const details = await apiRequest(
    "GET",
    `/api/sessions/${sessionId}`,
    hostToken,
  );
  assert.equal(details.status, 200);
  assert.equal(details.json.data?.status, "cancelled");

  const cancelAgain = await apiRequest(
    "POST",
    `/api/sessions/${sessionId}/cancel`,
    hostToken,
  );
  assert.equal(
    cancelAgain.status,
    400,
    `Expected second cancel to return 400, got ${cancelAgain.status} (${cancelAgain.json.error || ""})`,
  );

  const cancelledList = await apiRequest(
    "GET",
    "/api/sessions?status=cancelled",
    hostToken,
  );
  assert.equal(cancelledList.status, 200);
  assert.ok(
    Array.isArray(cancelledList.json.data) &&
      cancelledList.json.data.some((s) => s.id === sessionId),
    "Expected cancelled session to appear in filtered sessions list",
  );
});

test("session lifecycle: member join/leave and host/member permission checks", async () => {
  const hostToken = await signInAndGetAccessToken(hostEmail, hostPassword);
  const friendToken = await signInAndGetAccessToken(
    friendEmail,
    friendPassword,
  );

  const created = await apiRequest("POST", "/api/sessions", hostToken, {
    name: `E2E Lifecycle Permissions ${Date.now()}`,
    latitude: 37.7749,
    longitude: -122.4194,
    radius_meters: 5000,
    category_filter: "restaurants",
  });

  assert.equal(created.status, 201);
  const sessionId = created.json.data?.id;
  const inviteCode = created.json.data?.invite_code;
  assert.ok(sessionId, "Expected created session id");
  assert.ok(inviteCode, "Expected created session invite_code");

  const friendJoin = await apiRequest(
    "POST",
    "/api/sessions/join-by-code",
    friendToken,
    { code: inviteCode },
  );
  assert.equal(
    friendJoin.status,
    200,
    `Expected friend join status 200, got ${friendJoin.status} (${friendJoin.json.error || ""})`,
  );
  assert.equal(friendJoin.json.data?.session_id, sessionId);

  const friendCancel = await apiRequest(
    "POST",
    `/api/sessions/${sessionId}/cancel`,
    friendToken,
  );
  assert.equal(
    friendCancel.status,
    403,
    `Expected non-host cancel status 403, got ${friendCancel.status} (${friendCancel.json.error || ""})`,
  );

  const hostLeave = await apiRequest(
    "DELETE",
    `/api/sessions/${sessionId}/leave`,
    hostToken,
  );
  assert.equal(
    hostLeave.status,
    400,
    `Expected host leave status 400, got ${hostLeave.status} (${hostLeave.json.error || ""})`,
  );

  const friendLeave = await apiRequest(
    "DELETE",
    `/api/sessions/${sessionId}/leave`,
    friendToken,
  );
  assert.equal(
    friendLeave.status,
    200,
    `Expected friend leave status 200, got ${friendLeave.status} (${friendLeave.json.error || ""})`,
  );

  const hostCancel = await apiRequest(
    "POST",
    `/api/sessions/${sessionId}/cancel`,
    hostToken,
  );
  assert.equal(hostCancel.status, 200);

  const detailsAfter = await apiRequest(
    "GET",
    `/api/sessions/${sessionId}`,
    hostToken,
  );
  assert.equal(detailsAfter.status, 200);
  assert.equal(detailsAfter.json.data?.status, "cancelled");
});
