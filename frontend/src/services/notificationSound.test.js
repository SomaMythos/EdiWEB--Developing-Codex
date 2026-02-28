import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotificationSoundPlayer,
  getNewNotifications,
  isInQuietHours,
  resolveSoundKey,
} from './notificationSoundCore.js';

test('getNewNotifications returns only unseen ids', () => {
  const knownIds = new Set([1, 3]);
  const next = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const result = getNewNotifications(next, knownIds);

  assert.deepEqual(result.map((item) => item.id), [2, 4]);
});

test('playBatch debounces bursts of the same sound key', () => {
  const played = [];
  const player = createNotificationSoundPlayer({
    soundCatalog: { default: 'default.wav', warning: 'warning.wav' },
    debounceMs: 500,
    nowProvider: () => new Date('2026-02-28T10:00:00.000Z'),
    createAudio: (src) => ({
      src,
      volume: 0,
      play: () => {
        played.push(src);
        return Promise.resolve();
      },
    }),
  });

  const preferences = {
    enabled: true,
    volume: 0.8,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  };

  const first = player.playBatch({
    notifications: [{ id: 10, severity: 'warning' }, { id: 11, severity: 'warning' }],
    getSeverity: (item) => item.severity,
    preferences,
  });
  const second = player.playBatch({
    notifications: [{ id: 12, severity: 'warning' }],
    getSeverity: (item) => item.severity,
    preferences,
  });

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(played.length, 1);
});

test('resolveSoundKey prioritizes explicit sound_key then severity', () => {
  const catalog = { default: 'x', critical: 'y', soft: 'z' };
  assert.equal(resolveSoundKey({ sound_key: 'soft' }, 'critical', catalog), 'soft');
  assert.equal(resolveSoundKey({}, 'critical', catalog), 'critical');
  assert.equal(resolveSoundKey({}, 'unknown', catalog), 'default');
});

test('isInQuietHours supports overnight ranges', () => {
  const at2330 = new Date('2026-02-28T23:30:00');
  const at0900 = new Date('2026-02-28T09:00:00');

  assert.equal(isInQuietHours(at2330, '22:00', '07:00'), true);
  assert.equal(isInQuietHours(at0900, '22:00', '07:00'), false);
});
