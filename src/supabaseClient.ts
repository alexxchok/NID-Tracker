// @ts-nocheck
// ============================================================
// supabaseClient.ts — your database connection, in ONE place.
//
// 👉 PASTE YOUR REAL SUPABASE KEY BELOW. It arrived hidden
//    (as ******) in the file you sent, so I could not carry it
//    over. Until you paste it, the app connects to nothing.
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yymvagbwxdaxrldrhmtm.supabase.co';

// ⬇⬇⬇ PASTE YOUR KEY BETWEEN THE QUOTES ⬇⬇⬇
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
// ⬆⬆⬆ PASTE YOUR KEY BETWEEN THE QUOTES ⬆⬆⬆

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==== ADMIN ACCESS CONTROL ====
// Enter admin emails in lowercase. Only these users see edit buttons.
export const ADMIN_EMAILS = [
  'alex.chok@qigroup.com',
  // 'second-admin@company.com',
];