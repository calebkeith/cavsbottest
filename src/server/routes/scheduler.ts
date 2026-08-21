import { Hono } from 'hono';
import type { TaskRequest, TaskResponse } from '@devvit/scheduler';
import { updateSidebarAndWidgets } from '../core/sidebar';
import { createScheduledThreads } from '../core/post';

export const scheduler = new Hono();

scheduler.post('/update-sidebar', async (c) => {
  const task = await c.req.json<TaskRequest>().catch(() => undefined);
  if (!task?.name || !['update-sidebar', 'update-game-threads'].includes(task.name)) return c.json({ status: 'error', message: 'Unknown scheduler task' }, 400);

  try {
    if (task.name === 'update-sidebar') await updateSidebarAndWidgets();
    if (task.name === 'update-game-threads') await createScheduledThreads();
    return c.json<TaskResponse>({});
  } catch (error) {
    console.error('Sidebar refresh failed:', error instanceof Error ? error.stack : error);
    return c.json({ status: 'error', message: error instanceof Error ? `Sidebar refresh failed: ${error.message}` : 'Sidebar refresh failed' }, 502);
  }
});

scheduler.post('/update-game-threads', async (c) => {
  try {
    await createScheduledThreads();
    return c.json<TaskResponse>({});
  } catch (error) {
    console.error('Game thread refresh failed:', error);
    return c.json({ status: 'error', message: 'Game thread refresh failed' }, 502);
  }
});