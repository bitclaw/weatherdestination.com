type Account = {
  sessionToken: string;
  isActive: boolean;
};

export type SignOutAction =
  | { type: 'revoke'; sessionToken: string }
  | { type: 'signOut' };

export function getSignOutAction(accounts: Account[]): SignOutAction {
  const activeAccount = accounts.find(a => a.isActive);
  const otherSessions = accounts.filter(a => !a.isActive);

  if (otherSessions.length > 0 && activeAccount) {
    return { type: 'revoke', sessionToken: activeAccount.sessionToken };
  }
  return { type: 'signOut' };
}
