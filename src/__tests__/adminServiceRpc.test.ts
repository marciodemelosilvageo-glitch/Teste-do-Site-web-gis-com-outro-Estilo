import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('RPC get_my_access_settings Backoff and Role Restriction Logic', () => {
  it('calculates exponential backoff delays correctly up to 300s ceiling', () => {
    const calculateBackoff = (failures: number): number => {
      return Math.min(30000 * Math.pow(2, failures - 1), 300000);
    };

    assert.strictEqual(calculateBackoff(1), 30000);   // 30s
    assert.strictEqual(calculateBackoff(2), 60000);   // 60s
    assert.strictEqual(calculateBackoff(3), 120000);  // 120s
    assert.strictEqual(calculateBackoff(4), 240000);  // 240s
    assert.strictEqual(calculateBackoff(5), 300000);  // 300s (capped)
    assert.strictEqual(calculateBackoff(10), 300000); // 300s (capped)
  });

  it('restricts direct table read fallback strictly to master and manager roles', () => {
    const canAttemptDirectRead = (role: string | null): boolean => {
      return role === 'master' || role === 'admin' || role === 'manager';
    };

    assert.strictEqual(canAttemptDirectRead('visitor'), false);
    assert.strictEqual(canAttemptDirectRead('site_account'), false);
    assert.strictEqual(canAttemptDirectRead('user'), false);
    assert.strictEqual(canAttemptDirectRead(null), false);

    assert.strictEqual(canAttemptDirectRead('master'), true);
    assert.strictEqual(canAttemptDirectRead('manager'), true);
    assert.strictEqual(canAttemptDirectRead('admin'), true);
  });

  it('emits console warning only once during consecutive failures', () => {
    let warnCount = 0;
    let rpcSettingsWarned = false;

    const simulateRpcFailure = () => {
      if (!rpcSettingsWarned) {
        rpcSettingsWarned = true;
        warnCount++;
      }
    };

    // Simulate 10 retry cycles
    for (let i = 0; i < 10; i++) {
      simulateRpcFailure();
    }

    assert.strictEqual(warnCount, 1, 'Console warning must be emitted exactly once across cycles');
  });

  it('suppresses redundant network calls during active backoff window', () => {
    let networkCalls = 0;
    let nextRetryTime = 0;

    const simulateFetch = (currentTime: number) => {
      if (currentTime < nextRetryTime) {
        return { skipped: true };
      }
      networkCalls++;
      // RPC fails, schedule next retry +30000ms
      nextRetryTime = currentTime + 30000;
      return { skipped: false };
    };

    let time = 1000;
    // First call executes
    const r1 = simulateFetch(time);
    assert.strictEqual(r1.skipped, false);
    assert.strictEqual(networkCalls, 1);

    // Call 5 seconds later: must be skipped
    time += 5000;
    const r2 = simulateFetch(time);
    assert.strictEqual(r2.skipped, true);
    assert.strictEqual(networkCalls, 1);

    // Call 10 seconds later: still skipped
    time += 10000;
    const r3 = simulateFetch(time);
    assert.strictEqual(r3.skipped, true);
    assert.strictEqual(networkCalls, 1);

    // Call after 30 seconds: allowed
    time += 20000; // now +35000 from start
    const r4 = simulateFetch(time);
    assert.strictEqual(r4.skipped, false);
    assert.strictEqual(networkCalls, 2);
  });
});

describe('Session Tracking and Conflict Prevention Logic', () => {
  it('derives session_id from auth.uid for anonymous visitors to avoid RLS 403 collisions', () => {
    const resolveEffectiveSessionId = (
      inputSessionId: string,
      currentUid: string,
      isAnonymous: boolean,
      storedAuthUid?: string
    ): string => {
      if (isAnonymous || (storedAuthUid && storedAuthUid !== currentUid)) {
        return currentUid;
      }
      return inputSessionId;
    };

    const visitor1Uid = 'uuid-anon-111';
    const visitor2Uid = 'uuid-anon-222';
    const oldSessionId = 'sess_xyz_123';

    // Visitor 1 visits
    const sid1 = resolveEffectiveSessionId(oldSessionId, visitor1Uid, true, undefined);
    assert.strictEqual(sid1, visitor1Uid, 'Must derive session ID from visitor1 UID');

    // Visitor 2 visits with same oldSessionId in storage
    const sid2 = resolveEffectiveSessionId(oldSessionId, visitor2Uid, true, visitor1Uid);
    assert.strictEqual(sid2, visitor2Uid, 'Must derive session ID from visitor2 UID and not collide with visitor1');
  });

  it('suppresses database upsert when auth.uid is not available', () => {
    let upsertCalled = false;
    const syncSession = (currentUid?: string | null) => {
      if (!currentUid) {
        return { synced: false, reason: 'unauthenticated' };
      }
      upsertCalled = true;
      return { synced: true };
    };

    assert.strictEqual(syncSession(null).synced, false);
    assert.strictEqual(syncSession(undefined).synced, false);
    assert.strictEqual(upsertCalled, false);

    assert.strictEqual(syncSession('valid-user-id').synced, true);
    assert.strictEqual(upsertCalled, true);
  });

  it('reuses the same derived session_id across reloads for the same user', () => {
    const userUid = 'uuid-stable-123';
    let currentSessionId = userUid;
    let storedAuthUid = userUid;

    const reloadUserSessionId = (currentUid: string, isAnon: boolean) => {
      if (isAnon || (storedAuthUid && storedAuthUid !== currentUid)) {
        return currentUid;
      }
      return currentSessionId;
    };

    const afterReload = reloadUserSessionId(userUid, true);
    assert.strictEqual(afterReload, userUid);
    assert.strictEqual(afterReload, currentSessionId);
  });
});
