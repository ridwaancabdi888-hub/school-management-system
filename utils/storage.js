const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const env = require('../config/env');

let client = null;
function getClient() {
  if (!client) {
    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to upload files');
    }
    // service_role bypasses RLS — this key must never reach the frontend
    // (it isn't; only the server process holds it, via env vars).
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey);
  }
  return client;
}

// Uploads a buffer to the shared `uploads` Supabase Storage bucket and
// returns its public URL. Vercel's filesystem is ephemeral/read-only per
// invocation, so logos/photos/gallery images can't be written to local
// disk the way the original MySQL-era app did — this is the production-
// safe replacement.
async function uploadFile(buffer, folder, originalName, mimetype) {
  const ext = path.extname(originalName || '').toLowerCase();
  const objectPath = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
  const supabase = getClient();
  const { error } = await supabase.storage
    .from(env.supabase.storageBucket)
    .upload(objectPath, buffer, { contentType: mimetype, upsert: false });
  if (error) throw new Error(`File upload failed: ${error.message}`);
  const { data } = supabase.storage.from(env.supabase.storageBucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

module.exports = { uploadFile };
