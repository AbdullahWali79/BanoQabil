import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hlcxuhzbpugzzbwogfvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3h1aHpicHVnenpid29nZnZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTU3NzIsImV4cCI6MjEwMDYzMTc3Mn0.wBEhD14EhYOii0ze1KSOeg4fuuMCgXg_CRVf_NtoCeA';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deeplySolve() {
  console.log("1. Fetching roles...");
  const { data: roles, error: rolesErr } = await supabase.from('roles').select('id, name');
  if (rolesErr) {
    console.error("Failed to fetch roles:", rolesErr);
    return;
  }
  
  const superAdminRole = roles.find(r => r.name === 'Super Admin')?.id;
  const adminRole = roles.find(r => r.name === 'Admin')?.id;

  if (!superAdminRole) {
    console.error("Super Admin role not found!");
    return;
  }

  console.log("2. Logging in as Super Admin...");
  const { data: saLogin, error: saLoginErr } = await supabase.auth.signInWithPassword({
    email: 'abdullahwali79@gmail.com',
    password: 'Abdullah123@'
  });

  if (saLoginErr) {
    console.error("Failed to login Super Admin:", saLoginErr.message);
    return;
  }

  const saId = saLogin.user.id;
  console.log(`Logged in successfully. User ID: ${saId}`);

  console.log("3. Updating profile for Super Admin using their own session...");
  // Now that we are logged in, we have an authenticated session and RLS allows updating own profile!
  const { data: saUpdate, error: saUpdateErr } = await supabase
    .from('profiles')
    .update({ 
      status: 'Approved',
      role_id: superAdminRole
    })
    .eq('id', saId)
    .select();

  if (saUpdateErr) {
    console.error("Failed to update Super Admin profile:", saUpdateErr.message);
  } else {
    console.log("Super Admin profile updated successfully!", saUpdate);
  }

  // Optional: Do the same for Admin
  await supabase.auth.signOut();
  console.log("4. Logging in as Admin...");
  const { data: aLogin, error: aLoginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@banoqabil.com',
    password: 'AdminPassword123@'
  });

  if (!aLoginErr && aLogin.user) {
    const aId = aLogin.user.id;
    const { error: aUpdateErr } = await supabase
      .from('profiles')
      .update({ 
        status: 'Approved',
        role_id: adminRole
      })
      .eq('id', aId);
      
    if (aUpdateErr) {
      console.error("Failed to update Admin profile:", aUpdateErr.message);
    } else {
      console.log("Admin profile updated successfully!");
    }
  }

  console.log("Finished deeply solving the issue.");
}

deeplySolve();
