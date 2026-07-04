import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ylhpitwhkgwzmjznkhmy.supabase.co'
const supabaseAnonKey = 'sb_publishable_VtB5ET9QuI4EXfXyoRKIeQ_39ERA3J0' // Key này an toàn khi lộ nếu bạn đã bật RLS

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
