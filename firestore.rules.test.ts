/**
 * Firestore Security Rules Verification Suite (Dirty Dozen Test Runner)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Role Escalation',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      uid: 'user_123',
      username: 'Hacker',
      role: 'admin',
      bookmarks: [],
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on User Profile',
    operation: 'create',
    path: '/users/victim_999',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      uid: 'victim_999',
      username: 'Spoofer',
      role: 'reader',
      bookmarks: [],
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Profile Update',
    operation: 'update',
    path: '/users/user_123',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      uid: 'user_123',
      username: 'ValidName',
      role: 'reader',
      bookmarks: [],
      isVerified: true,
      createdAt: 'EXISTING_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Spoofing Attack on Admin',
    operation: 'update',
    path: '/requests/req_1',
    auth: { uid: 'spoof_admin', email: 'yuniquearun@gmail.com', email_verified: false },
    payload: {
      status: 'Acquired',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-User PII Read on Split Collection',
    operation: 'get',
    path: '/users/victim_999/private/info',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Progress Write Without Parent User Profile',
    operation: 'create',
    path: '/users/ghost_user/progress/solo-leveling',
    auth: { uid: 'ghost_user', email: 'ghost@example.com', email_verified: true },
    payload: {
      userId: 'ghost_user',
      seriesId: 'solo-leveling',
      chapterId: 'ch_1',
      chapterNumber: 1,
      seriesTitle: 'Solo Leveling',
      seriesSlug: 'solo-leveling',
      seriesType: 'webtoon',
      coverImage: 'https://example.com/cover.jpg',
      pageIndex: 0,
      totalPages: 20,
      scrollPercentage: 10,
      isCompleted: false,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Comment Creation Without Existing User Profile',
    operation: 'create',
    path: '/comments/cmt_1',
    auth: { uid: 'user_no_profile', email: 'noprofile@example.com', email_verified: true },
    payload: {
      chapterId: 'ch_1',
      seriesId: 'solo-leveling',
      authorId: 'user_no_profile',
      username: 'Anon',
      content: 'Great episode!',
      spoiler: false,
      upvotes: 0,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'ID Poisoning / Invalid Path Variable',
    operation: 'create',
    path: '/comments/invalid$id!with@bad#chars',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      chapterId: 'ch_1',
      seriesId: 'solo-leveling',
      authorId: 'user_123',
      username: 'Reader',
      content: 'Nice!',
      spoiler: false,
      upvotes: 0,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Denial of Wallet / Oversized Content String Poisoning',
    operation: 'update',
    path: '/comments/cmt_1',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      content: 'x'.repeat(2000),
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Terminal State Lock Bypass on Acquired Request',
    operation: 'update',
    path: '/requests/req_acquired',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      votes: 999,
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized Non-Admin Series Catalog Mutation',
    operation: 'update',
    path: '/series/series-solo-leveling',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      title: 'Hacked Title',
      updatedAt: 'SERVER_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Forged Client Timestamp on Request Creation',
    operation: 'create',
    path: '/requests/req_2',
    auth: { uid: 'user_123', email: 'reader@example.com', email_verified: true },
    payload: {
      title: 'Berserk',
      type: 'manga',
      author: 'Kentaro Miura',
      reason: 'Masterpiece dark fantasy manga.',
      requestedBy: 'Reader',
      authorId: 'user_123',
      votes: 1,
      status: 'Pending',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];
