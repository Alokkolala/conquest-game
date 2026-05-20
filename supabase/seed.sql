-- Clear old data
DELETE FROM challenges;
DELETE FROM territories;

-- Seed world territories matching BOT_CLUSTERS in lib/game-state.ts
-- CrimsonGuard = Western Europe (fr, es, pt, be, nl)
INSERT INTO territories (name, hex_q, hex_r, owner_id) VALUES
('France',       0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Spain',        0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Portugal',     0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Belgium',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Netherlands',  0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),

-- AzureCrown = Eastern Europe (ru, ua, by, pl, ro)
('Russia',       0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Ukraine',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Belarus',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Poland',       0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Romania',      0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),

-- VerdantHold = South/SE Asia (in, pk, bd, mm, th)
('India',        0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Pakistan',     0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Bangladesh',   0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Myanmar',      0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('Thailand',     0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),

-- ObsidianPact = Middle East (tr, ir, iq, sa, eg)
('Turkey',       0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Iran',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Iraq',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Saudi Arabia', 0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
('Egypt',        0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact'))

ON CONFLICT DO NOTHING;

-- Refresh territory_count for each profile
UPDATE profiles p
SET territory_count = (SELECT COUNT(*) FROM territories WHERE owner_id = p.id);
