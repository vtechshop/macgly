const { ensureSession, getSessionId, clearSession, SESSION_COOKIE } = require('../../middleware/session');

function mockReqRes(cookies = {}) {
  const res = {
    cookies: {},
    cleared: [],
    cookie(name, value, opts) { this.cookies[name] = { value, opts }; },
    clearCookie(name, opts) { this.cleared.push({ name, opts }); },
  };
  return { req: { cookies: { ...cookies } }, res };
}

function run(cookies) {
  const { req, res } = mockReqRes(cookies);
  let called = false;
  ensureSession(req, res, () => { called = true; });
  return { req, res, called };
}

describe('session middleware', () => {
  it('issues a 128-bit hex session id to a visitor with no cookie', () => {
    const { req, res, called } = run();
    expect(called).toBe(true);
    expect(req.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.cookies[SESSION_COOKIE].value).toBe(req.sessionId);
    expect(req.sessionIsNew).toBe(true);
  });

  it('issues a different id to every new visitor', () => {
    const ids = new Set();
    for (let i = 0; i < 500; i++) ids.add(run().req.sessionId);
    expect(ids.size).toBe(500);
  });

  it('reuses a valid existing session id and sets no new cookie', () => {
    const existing = 'a'.repeat(32);
    const { req, res } = run({ [SESSION_COOKIE]: existing });
    expect(req.sessionId).toBe(existing);
    expect(req.sessionIsNew).toBe(false);
    expect(res.cookies[SESSION_COOKIE]).toBeUndefined();
  });

  it.each([
    ['anon', 'the old shared literal'],
    ['', 'empty string'],
    ['ANON', 'uppercase'],
    ['../../etc/passwd', 'path traversal'],
    ['a'.repeat(31), 'too short'],
    ['a'.repeat(33), 'too long'],
    ['g'.repeat(32), 'non-hex characters'],
    ['{"$ne":null}', 'nosql operator payload'],
  ])('rejects %s (%s) and issues a fresh id', (bad) => {
    const { req } = run({ [SESSION_COOKIE]: bad });
    expect(req.sessionId).not.toBe(bad);
    expect(req.sessionId).toMatch(/^[0-9a-f]{32}$/);
    expect(req.sessionIsNew).toBe(true);
  });

  it('sets the cookie httpOnly, lax, root path and 30 days', () => {
    const { res } = run();
    const { opts } = res.cookies[SESSION_COOKIE];
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('tolerates a request with no cookies object at all', () => {
    const res = { cookie() {}, clearCookie() {} };
    const req = {};
    expect(() => ensureSession(req, res, () => {})).not.toThrow();
    expect(req.sessionId).toMatch(/^[0-9a-f]{32}$/);
  });

  describe('getSessionId', () => {
    it('returns null when no session is present', () => {
      expect(getSessionId({ cookies: {} })).toBeNull();
    });

    it('returns null for an invalid cookie instead of trusting it', () => {
      expect(getSessionId({ cookies: { [SESSION_COOKIE]: 'anon' } })).toBeNull();
    });

    it('reads a valid cookie without issuing one', () => {
      const id = 'b'.repeat(32);
      expect(getSessionId({ cookies: { [SESSION_COOKIE]: id } })).toBe(id);
    });

    it('prefers req.sessionId set earlier in the same request', () => {
      const id = 'c'.repeat(32);
      expect(getSessionId({ sessionId: id, cookies: {} })).toBe(id);
    });
  });

  describe('clearSession', () => {
    it('clears the cookie with matching attributes', () => {
      const { res } = mockReqRes();
      clearSession(res);
      expect(res.cleared).toHaveLength(1);
      expect(res.cleared[0].name).toBe(SESSION_COOKIE);
      expect(res.cleared[0].opts.path).toBe('/');
      expect(res.cleared[0].opts.sameSite).toBe('lax');
    });
  });
});
