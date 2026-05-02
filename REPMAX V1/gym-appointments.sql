-- Define Gym Appointments Table
CREATE TABLE IF NOT EXISTS gym_appointments (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id) on delete cascade not null,
  guest_id uuid references auth.users(id) on delete cascade not null,
  gym_name text not null,
  scheduled_at timestamp with time zone not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  creator_arrived boolean default false,
  guest_arrived boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS
ALTER TABLE gym_appointments ENABLE ROW LEVEL SECURITY;

-- Policies for visibility
CREATE POLICY "Users can see their own appointments" 
  ON gym_appointments FOR SELECT 
  USING (auth.uid() = creator_id OR auth.uid() = guest_id);

-- Policies for creating appointments
CREATE POLICY "Users can create appointments" 
  ON gym_appointments FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

-- Policies for updating (accepting, marking arrived, cancelling)
CREATE POLICY "Users can update their appointments" 
  ON gym_appointments FOR UPDATE 
  USING (auth.uid() = creator_id OR auth.uid() = guest_id);

-- Policies for deleting (cancelling via delete)
CREATE POLICY "Users can delete their appointments" 
  ON gym_appointments FOR DELETE 
  USING (auth.uid() = creator_id OR auth.uid() = guest_id);
