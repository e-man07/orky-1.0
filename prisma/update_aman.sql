-- Update Aman Jha's profile to Australia + Contractor
UPDATE users SET location = 'Australia', department = 'IT', company = 'Avasop' WHERE email = 'amann.jha1107@gmail.com';

-- Add contractor role
INSERT INTO user_roles (user_id, role_name)
SELECT id, 'orky contractors' FROM users WHERE email = 'amann.jha1107@gmail.com'
ON CONFLICT (user_id, role_name) DO NOTHING;
