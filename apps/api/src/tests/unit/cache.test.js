// Force memory store by making getRedis return null
jest.mock('../../config/redis', () => ({ getRedis: () => null }));

const { getCache, setCache, deleteCache } = require('../../utils/cache');

describe('Cache utility (memory store)', () => {
  afterEach(async () => {
    // Clear all keys between tests
    await deleteCache('*');
  });

  describe('setCache / getCache', () => {
    test('stores and retrieves a value', async () => {
      await setCache('key1', { name: 'test' }, 60);
      const val = await getCache('key1');
      expect(val).toEqual({ name: 'test' });
    });

    test('returns null for missing key', async () => {
      const val = await getCache('nonexistent_key_xyz');
      expect(val).toBeNull();
    });

    test('stores strings, numbers, arrays', async () => {
      await setCache('str', 'hello', 60);
      await setCache('num', 42, 60);
      await setCache('arr', [1, 2, 3], 60);

      expect(await getCache('str')).toBe('hello');
      expect(await getCache('num')).toBe(42);
      expect(await getCache('arr')).toEqual([1, 2, 3]);
    });

    test('overwrites existing key', async () => {
      await setCache('dup', 'first', 60);
      await setCache('dup', 'second', 60);
      expect(await getCache('dup')).toBe('second');
    });

    test('expires entry after TTL', async () => {
      await setCache('exp_key', 'soon', 0.001); // ~1ms TTL
      await new Promise((r) => setTimeout(r, 50));
      const val = await getCache('exp_key');
      expect(val).toBeNull();
    });
  });

  describe('deleteCache', () => {
    test('removes a specific key', async () => {
      await setCache('del_me', 'value', 60);
      await deleteCache('del_me');
      expect(await getCache('del_me')).toBeNull();
    });

    test('removes keys matching a prefix pattern', async () => {
      await setCache('prefix:a', 1, 60);
      await setCache('prefix:b', 2, 60);
      await setCache('other:c', 3, 60);
      await deleteCache('prefix:*');
      expect(await getCache('prefix:a')).toBeNull();
      expect(await getCache('prefix:b')).toBeNull();
      expect(await getCache('other:c')).toBe(3);
    });
  });
});
