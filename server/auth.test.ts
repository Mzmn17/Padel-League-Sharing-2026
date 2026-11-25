import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdminToken,
  getAuthConfigState,
  hashPassword,
  revokeAdminToken,
  verifyAdminCredentials,
  verifyAdminToken,
  verifyPassword,
} from './auth.ts';

test('hashPassword and verifyPassword validate scrypt hashes with unique salts', () => {
  const hash1 = hashPassword('PadelMakassar2026!');
  const hash2 = hashPassword('PadelMakassar2026!');
  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword('PadelMakassar2026!', hash1), true);
  assert.equal(verifyPassword('WrongPassword', hash1), false);
});

test('createAdminToken, verifyAdminToken, and revokeAdminToken enforce token integrity and logout', () => {
  const token = createAdminToken('admin');
  const payload = verifyAdminToken(token);
  assert.ok(payload);
  assert.equal(payload.sub, 'admin');
  assert.equal(payload.role, 'admin');

  const tampered = `${token.slice(0, -4)}aaaa`;
  assert.equal(verifyAdminToken(tampered), null);

  revokeAdminToken(token);
  assert.equal(verifyAdminToken(token), null);

  const expired = createAdminToken('admin', -1000);
  assert.equal(verifyAdminToken(expired), null);
});

test('getAuthConfigState and verifyAdminCredentials handle unconfigured, claimed, and env override modes', () => {
  const prevPassword = process.env.ADMIN_PASSWORD;
  const prevUsername = process.env.ADMIN_USERNAME;

  try {
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_USERNAME;

    const unconfigured = getAuthConfigState({ token: '' });
    assert.equal(unconfigured.needsSetup, true);
    assert.equal(verifyAdminCredentials('admin', 'secret123', { token: '' }).reason, 'needs_setup');

    const claimedSecrets = {
      token: '',
      adminUsername: 'ketua-panitia',
      adminPasswordHash: hashPassword('SulawesiPadel99'),
    };
    const claimed = getAuthConfigState(claimedSecrets);
    assert.equal(claimed.needsSetup, false);
    assert.equal(claimed.mode, 'claimed');
    assert.equal(verifyAdminCredentials('ketua-panitia', 'SulawesiPadel99', claimedSecrets).ok, true);
    assert.equal(verifyAdminCredentials('ketua-panitia', 'wrong', claimedSecrets).ok, false);

    // Env override takes precedence over claimed password
    process.env.ADMIN_PASSWORD = 'EnvOverridePassword';
    process.env.ADMIN_USERNAME = 'superadmin';
    const envState = getAuthConfigState(claimedSecrets);
    assert.equal(envState.mode, 'env');
    assert.equal(envState.envConfigured, true);
    assert.equal(verifyAdminCredentials('superadmin', 'EnvOverridePassword', claimedSecrets).ok, true);
    assert.equal(verifyAdminCredentials('ketua-panitia', 'SulawesiPadel99', claimedSecrets).ok, false);
  } finally {
    if (prevPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prevPassword;
    if (prevUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = prevUsername;
  }
});
