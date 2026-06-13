/**
 * Create or update a Supabase admin auth user and grant admin role.
 *
 * Usage (bobbin-rental):
 *   set SUPABASE_URL=https://vkubxrydtwggvmkbsano.supabase.co
 *   set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
 *   node scripts/create-admin.mjs sunyheo@naver.com YourPassword123
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const email = (process.argv[2] ?? "sunyheo@naver.com").trim().toLowerCase();
const password = process.argv[3];

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!password || password.length < 6) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password-min-6-chars>");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (!data.users.length || data.users.length < 200) break;
  }
  return null;
}

const existing = await findUserByEmail(email);
let userId = existing?.id;

if (existing) {
  const { error } = await supabase.auth.admin.updateUserById(existing.id, {
    email_confirm: true,
    password,
  });
  if (error) throw error;
  console.log(`Updated existing user: ${email}`);
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  userId = data.user.id;
  console.log(`Created user: ${email}`);
}

const { error: roleErr } = await supabase
  .from("user_roles")
  .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
if (roleErr) throw roleErr;

console.log(`Granted admin role to ${email}`);
