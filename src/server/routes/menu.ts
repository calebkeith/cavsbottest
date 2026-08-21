import { Hono } from 'hono';
import type { Context } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost, createTestThread, type TestThreadKind } from '../core/post';
import { updateSidebarAndWidgets } from '../core/sidebar';
import { threadCacheGenerationKey, threadCoreCacheKey, threadDataCacheKey, threadInsightSectionCacheKey, threadInsightsCacheKey } from './api';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

menu.post('/sidebar-refresh', async (c) => {
  try {
    await updateSidebarAndWidgets();
    return c.json<UiResponse>({ showToast: 'CavsBot sidebar and widgets updated' }, 200);
  } catch (error) {
    console.error('Manual sidebar refresh failed:', error);
    return c.json<UiResponse>({ showToast: 'CavsBot sidebar refresh failed' }, 502);
  }
});

menu.post('/thread-cache-clear', async (c) => {
  const postData = context.postData;
  const gameId = typeof postData?.gameId === 'string' ? postData.gameId : undefined;
  const threadType = typeof postData?.threadType === 'string' ? postData.threadType : 'game';
  if (!gameId) return c.json<UiResponse>({ showToast: 'This post is not linked to a game' }, 400);

  const cacheKey = threadDataCacheKey(gameId, threadType);
  try {
    await redis.incrBy(threadCacheGenerationKey(gameId, threadType), 1);
    await redis.del(
      cacheKey,
      threadCoreCacheKey(gameId, threadType),
      threadInsightsCacheKey(gameId, threadType),
      ...['records', 'standings', 'recent-form', 'past-matchups', 'four-factors'].map((section) => threadInsightSectionCacheKey(gameId, threadType, section)),
      threadInsightSectionCacheKey(gameId, threadType, 'four-factors-v2'),
      threadInsightSectionCacheKey(gameId, threadType, 'four-factors-v3'),
    );
    console.log(`[thread-cache] cleared ${cacheKey}`);
    return c.json<UiResponse>({ showToast: `Cleared thread cache for ${threadType}` }, 200);
  } catch (error) {
    console.error(`Thread cache clear failed for ${cacheKey}:`, error);
    return c.json<UiResponse>({ showToast: 'Failed to clear thread cache' }, 502);
  }
});

const testThread = (kind: TestThreadKind) => async (c: Context) => {
  try {
    const post = await createTestThread(kind);
    if (!post) return c.json<UiResponse>({ showToast: 'Test thread already exists for game 0042500304' }, 200);
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` }, 200);
  } catch (error) {
    console.error(`Test ${kind} thread creation failed:`, error);
    return c.json<UiResponse>({ showToast: `Failed to create test ${kind} thread` }, 502);
  }
};

menu.post('/test-game-thread', testThread('game'));
menu.post('/test-game-day-thread', testThread('game-day'));
menu.post('/test-next-day-thread', testThread('next-day'));
menu.post('/test-post-game-thread', testThread('post-game'));
