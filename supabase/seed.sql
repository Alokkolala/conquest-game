-- Clear old hex territories
DELETE FROM challenges;
DELETE FROM territories;

-- Seed world territories (real countries)
-- hex_q and hex_r are legacy columns — set to 0
INSERT INTO territories (name, hex_q, hex_r, owner_id) VALUES
-- CrimsonGuard territories
('France',         0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Germany',        0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('United Kingdom', 0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Australia',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
('Argentina',      0, 0, (SELECT id FROM profiles WHERE username = 'CrimsonGuard')),
-- AzureCrown territories
('United States',  0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Brazil',         0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
('Italy',          0, 0, (SELECT id FROM profiles WHERE username = 'AzureCrown')),
-- VerdantHold territories
('South Africa',   0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
('India',          0, 0, (SELECT id FROM profiles WHERE username = 'VerdantHold')),
-- ObsidianPact territories
('Canada',         0, 0, (SELECT id FROM profiles WHERE username = 'ObsidianPact')),
-- Bot-only territories (these bots may not exist in seed, handle with subquery)
('Russia',         0, 0, (SELECT id FROM profiles WHERE username = 'Korchnoi_IV')),
('China',          0, 0, (SELECT id FROM profiles WHERE username = 'TigerOf64')),
('Japan',          0, 0, (SELECT id FROM profiles WHERE username = 'Hoshino'))
ON CONFLICT DO NOTHING;

-- Refresh territory_count for each profile
UPDATE profiles p
SET territory_count = (SELECT COUNT(*) FROM territories WHERE owner_id = p.id);
