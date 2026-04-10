import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

dotenv.config({ path: path.join(repoRoot, "apps/api/.env.local") });
dotenv.config({ path: path.join(repoRoot, "apps/mobile/.env") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase seed env vars.");
  console.error("Required: SUPABASE_SERVICE_ROLE_KEY");
  console.error("Required URL: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL");
  console.error(
    "Set them in apps/api/.env.local, apps/mobile/.env, or current shell env before running seed.",
  );
  process.exit(1);
}

const defaultPassword = process.env.E2E_PASSWORD || "BiteBuddy123!";

const ACCOUNTS = {
  host: {
    email: process.env.E2E_HOST_EMAIL || "e2e.host@bitebuddy.test",
    password: process.env.E2E_HOST_PASSWORD || defaultPassword,
    username: "e2e_host",
    displayName: "E2E Host",
  },
  friend: {
    email: process.env.E2E_FRIEND_EMAIL || "e2e.friend@bitebuddy.test",
    password: process.env.E2E_FRIEND_PASSWORD || defaultPassword,
    username: "e2e_friend",
    displayName: "E2E Friend",
  },
  needsSetup: {
    email:
      process.env.E2E_NEEDS_SETUP_EMAIL || "e2e.needs-setup@bitebuddy.test",
    password: process.env.E2E_NEEDS_SETUP_PASSWORD || defaultPassword,
    username: "user_e2e_setup",
    displayName: "E2E Setup",
  },
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;

    page += 1;
  }

  return users;
}

async function findUserByEmail(email) {
  const users = await listAllUsers();
  return (
    users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ??
    null
  );
}

async function createOrUpdateUser(account) {
  const existing = await findUserByEmail(account.email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          username: account.username,
          display_name: account.displayName,
        },
      },
    );
    if (error) throw error;
    return data.user.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      username: account.username,
      display_name: account.displayName,
    },
  });

  if (error) throw error;
  return data.user.id;
}

async function upsertProfiles(accountRows) {
  const { error } = await supabase
    .from("profiles")
    .upsert(accountRows, { onConflict: "id" });
  if (error) throw error;
}

async function reseedFriendship(hostId, friendId) {
  const { error: deleteError } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${hostId},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${hostId})`,
    );

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("friendships").insert({
    requester_id: hostId,
    addressee_id: friendId,
    status: "accepted",
  });

  if (insertError) throw insertError;
}

async function reseedSession(hostId, friendId) {
  const { data: oldSessions, error: selectError } = await supabase
    .from("sessions")
    .select("id")
    .eq("created_by", hostId)
    .eq("name", "E2E Selenium Session");

  if (selectError) throw selectError;

  const oldIds = (oldSessions ?? []).map((s) => s.id);
  if (oldIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("sessions")
      .delete()
      .in("id", oldIds);
    if (deleteError) throw deleteError;
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      created_by: hostId,
      name: "E2E Selenium Session",
      status: "waiting",
      latitude: 37.7749,
      longitude: -122.4194,
      radius_meters: 5000,
      category_filter: "restaurants",
    })
    .select("id")
    .single();

  if (sessionError) throw sessionError;

  const { error: membersError } = await supabase
    .from("session_members")
    .insert([
      { session_id: session.id, user_id: hostId },
      { session_id: session.id, user_id: friendId },
    ]);

  if (membersError) throw membersError;

  return session.id;
}

async function main() {
  const hostId = await createOrUpdateUser(ACCOUNTS.host);
  const friendId = await createOrUpdateUser(ACCOUNTS.friend);
  const needsSetupId = await createOrUpdateUser(ACCOUNTS.needsSetup);

  await upsertProfiles([
    {
      id: hostId,
      username: ACCOUNTS.host.username,
      display_name: ACCOUNTS.host.displayName,
    },
    {
      id: friendId,
      username: ACCOUNTS.friend.username,
      display_name: ACCOUNTS.friend.displayName,
    },
    {
      id: needsSetupId,
      username: ACCOUNTS.needsSetup.username,
      display_name: ACCOUNTS.needsSetup.displayName,
    },
  ]);

  await reseedFriendship(hostId, friendId);
  const sessionId = await reseedSession(hostId, friendId);

  console.log("Seeded E2E accounts and data:");
  console.log(`- Host: ${ACCOUNTS.host.email}`);
  console.log(`- Friend: ${ACCOUNTS.friend.email}`);
  console.log(`- Needs setup: ${ACCOUNTS.needsSetup.email}`);
  console.log(`- Session: ${sessionId}`);
}

main().catch((error) => {
  console.error("Failed to seed E2E accounts:", error.message || error);
  process.exit(1);
});
