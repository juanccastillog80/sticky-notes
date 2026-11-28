// Runs in Node, beside Playwright: real mouse input for browser tests.
import type {} from '@vitest/browser-playwright';
import type { BrowserCommand } from 'vitest/node';
import type { MouseStep } from './mouseStep';

/**
 * Plays `steps` through Playwright's `page.mouse`, the only input that real
 * pointer capture accepts. The test page is in a scaled iframe, so each point
 * is mapped into the outer page's coordinates.
 */
export const mouse: BrowserCommand<[steps: readonly MouseStep[]]> = async (ctx, steps) => {
  const frame = await ctx.frame();
  const frameElement = await frame.frameElement();
  const box = await frameElement.boundingBox();
  if (!box) throw new Error('The test iframe has no box');
  const innerWidth = await frame.evaluate<number>('window.innerWidth');
  const scale = box.width / innerWidth;

  for (const step of steps) {
    if (step.type === 'down') await ctx.page.mouse.down({ button: step.button ?? 'left' });
    else if (step.type === 'up') await ctx.page.mouse.up({ button: step.button ?? 'left' });
    else if (step.type === 'wheel') await ctx.page.mouse.wheel(0, step.deltaY);
    else {
      await ctx.page.mouse.move(box.x + step.x * scale, box.y + step.y * scale, {
        steps: step.steps ?? 1,
      });
    }
  }
};
