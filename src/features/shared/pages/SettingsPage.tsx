import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import { toastError, toastSuccess } from '@/lib/notify';
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
} from 'lucide-react';

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const { user, role, status, setUser } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoadingProfile(false);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);

    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, phone, address')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      setFullName(data?.full_name || user.user_metadata?.full_name || '');
      setPhone(data?.phone || '');
      setAddress(data?.address || '');
      setEmail(data?.email || user.email || '');
      setLoadingProfile(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toastError('Full name is required.');
      return;
    }

    setSavingProfile(true);

    const [{ error: profileError }, { data: authData, error: authError }] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          phone: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq('id', user.id),
      supabase.auth.updateUser({
        data: { full_name: trimmedName },
      }),
    ]);

    if (profileError || authError) {
      toastError(profileError || authError, 'Profile update failed.');
    } else {
      if (authData.user) setUser(authData.user);
      toastSuccess('Profile updated.');
    }

    setSavingProfile(false);
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) {
      toastError('No email on account.');
      return;
    }

    if (!currentPassword) {
      toastError('Enter your current password first.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toastError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword === currentPassword) {
      toastError('Use a different password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('Passwords do not match.');
      return;
    }

    setSavingPassword(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      toastError('Current password is incorrect.');
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toastError(error, 'Password update failed.');
    } else {
      toastSuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }

    setSavingPassword(false);
  };

  const initials = getInitials(fullName, email);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Profile & Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details and security.
        </p>
      </div>

      <Card className="overflow-hidden border-border/80">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-lg font-semibold">{fullName || 'Your profile'}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
              <Mail size={14} className="shrink-0" />
              {email || '—'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {role ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  <Shield size={12} />
                  {role}
                </span>
              ) : null}
              {status ? (
                <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Status: {status}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User size={18} className="text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>Update how your name and contact details appear.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingProfile ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Loading profile…
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Email</Label>
                  <Input id="settings-email" value={email} disabled className="bg-muted/50" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-name">Full Name</Label>
                  <Input
                    id="settings-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-phone" className="flex items-center gap-1.5">
                    <Phone size={14} />
                    Phone
                  </Label>
                  <Input
                    id="settings-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings-address" className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    Address
                  </Label>
                  <Input
                    id="settings-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="City / area"
                  />
                </div>

                <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
                  {savingProfile ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Profile'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound size={18} className="text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>
              Confirm your current password, then set a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <PasswordField
                id="settings-current-password"
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Enter current password"
                autoComplete="current-password"
              />

              <PasswordField
                id="settings-new-password"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />

              <PasswordField
                id="settings-confirm-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter new password"
                autoComplete="new-password"
              />

              <p className="text-xs text-muted-foreground">
                Use at least 8 characters. New password must match confirmation and differ from the
                current one.
              </p>

              <Button
                type="submit"
                variant="outline"
                disabled={savingPassword}
                className="w-full sm:w-auto"
              >
                {savingPassword ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating…
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
