'use client';

import { useEffect, useRef, useState } from 'react';
import type { IceStreamUser } from '../types';

export function AccountMenu({ user, busy, onSignOut }: { user: IceStreamUser; busy: boolean; onSignOut: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const initials = user.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <div className="account-menu" ref={root}>
      <button className="account-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <span>{initials}</span><div><strong>{user.display_name}</strong><small>{user.user_id}</small></div><i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <div className="account-popover" role="menu">
          <p>Signed in as</p>
          <strong>{user.display_name}</strong>
          <dl><div><dt>Username</dt><dd>@{user.username}</dd></div><div><dt>User ID</dt><dd>{user.user_id}</dd></div></dl>
          <button type="button" role="menuitem" onClick={onSignOut} disabled={busy}><span>↗</span>{busy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      )}
    </div>
  );
}
