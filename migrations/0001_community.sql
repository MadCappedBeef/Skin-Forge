CREATE TABLE IF NOT EXISTS community_users (
 steam_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
 is_admin INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0, hide_skins INTEGER NOT NULL DEFAULT 0, ban_reason TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS community_sessions (
 token_hash TEXT PRIMARY KEY, steam_id TEXT NOT NULL REFERENCES community_users(steam_id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS community_sessions_expiry ON community_sessions(expires_at);
CREATE TABLE IF NOT EXISTS community_logins (
 token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_nonces (nonce_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS community_skins (
 id TEXT PRIMARY KEY, steam_id TEXT NOT NULL REFERENCES community_users(steam_id), title TEXT NOT NULL,
 species TEXT NOT NULL, skin_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0, reason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS community_skins_date ON community_skins(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS community_skins_owner ON community_skins(steam_id);
CREATE TABLE IF NOT EXISTS community_reports (
 id TEXT PRIMARY KEY, skin_id TEXT NOT NULL REFERENCES community_skins(id), steam_id TEXT NOT NULL REFERENCES community_users(steam_id),
 reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0,
 UNIQUE(skin_id, steam_id)
);
CREATE TABLE IF NOT EXISTS community_audit (
 id TEXT PRIMARY KEY, admin_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
 reason TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS community_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
