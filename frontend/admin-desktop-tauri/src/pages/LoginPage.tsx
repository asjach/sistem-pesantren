import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { setUser } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await login(identifier.trim(), password);
      setUser(u);
      nav('/', { replace: true });
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <form
        id="form_login"
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6"
      >
        <div>
          <h1 className="text-xl font-bold">Masuk Admin</h1>
          <p className="text-sm text-muted-foreground">super_admin / admin · throttle 6/mnt</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="input_identifier">Email / HP / Username</Label>
          <Input
            id="input_identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="input_password">Kata sandi</Label>
          <Input
            id="input_password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {err && (
          <p id="text_error" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}
        <Button id="btn_login" className="w-full" disabled={busy}>
          {busy ? 'Memeriksa…' : 'Masuk'}
        </Button>
      </form>
    </div>
  );
}
