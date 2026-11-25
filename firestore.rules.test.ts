import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FIRESTORE_LIMITS,
  assertValidId,
  sanitizeCourtInput,
  sanitizeParticipantInput,
} from './src/utils/firestoreValidation.ts';

test('firestore.rules enforces global deny-all, verified sign-in, and covers every blueprint collection', () => {
  const blueprint = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
  ) as { firestore: Record<string, unknown> };
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

  assert.ok(rules.includes("rules_version = '2';"));
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(rules.includes('muhazman441@gmail.com'));

  for (const collectionPath of Object.keys(blueprint.firestore)) {
    const baseCollection = collectionPath.split('/')[1];
    assert.ok(
      rules.includes(`match /${baseCollection}/`),
      `Missing match block for ${baseCollection}`
    );
  }
});

test('sanitizeParticipantInput enforces blueprint maxLength and ID pattern constraints', () => {
  const longName = 'A'.repeat(180);
  const longRegion = 'R'.repeat(120);
  const sanitized = sanitizeParticipantInput({
    name: `  ${longName}  `,
    region: longRegion,
    representation: 'Cabang / Branch',
    categoryId: 'cat-double-man',
    level: 'Open',
  });

  assert.equal(sanitized.name.length, FIRESTORE_LIMITS.NAME_MAX);
  assert.equal(sanitized.region.length, FIRESTORE_LIMITS.REGION_MAX);
  assert.equal(sanitized.categoryId, 'cat-double-man');

  assert.throws(() => assertValidId('bad/id with spaces'), /tidak valid/i);
  assert.throws(() => assertValidId('x'.repeat(100)), /tidak valid/i);
  assert.throws(
    () =>
      sanitizeParticipantInput({
        name: '   ',
        region: 'Makassar',
        categoryId: 'cat-mens-open',
        level: 'Open',
      }),
    /wajib diisi/i
  );
});

test('sanitizeCourtInput bounds court name and surface strings', () => {
  const court = sanitizeCourtInput({
    name: '  Court 5 · VIP Glass  ',
    surface: 'Mondo Supercourt',
    isIndoor: true,
  });
  assert.equal(court.name, 'Court 5 · VIP Glass');
  assert.equal(court.isIndoor, true);
  assert.throws(
    () => sanitizeCourtInput({ name: ' ', surface: 'Turf', isIndoor: false }),
    /wajib diisi/i
  );
});
