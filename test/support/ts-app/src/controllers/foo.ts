import type {MojoContext} from '../../../../../lib/core.js';

export default class FooController {
  async hello (ctx: MojoContext): Promise<void> {
    const what: string = await ctx.testHelper('controller');
    await ctx.render({text: `Hello ${what}!`});
  }
}
