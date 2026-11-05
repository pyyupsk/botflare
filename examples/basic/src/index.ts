import { bot, command, option, time } from 'discordflare';
import { gateway } from 'discordflare/gateway';

const ping = command({ name: 'ping', description: 'Check that the bot answers' }, (c) =>
  c.reply(`pong, ${time(Date.now(), 'long-time')}`),
);

const roll = command(
  {
    name: 'roll',
    description: 'Roll dice',
    options: { sides: option('integer', { description: 'Sides on the die', min: 2, max: 100 }) },
  },
  (c) => {
    const sides = c.options.sides ?? 6;
    const rolled = 1 + Math.floor(Math.random() * sides);

    return c.reply(`You rolled ${rolled} on a d${sides}.`, {
      buttons: [{ id: `again:${sides}`, label: 'Roll again', emoji: '🎲' }],
    });
  },
);

const app = bot({
  commands: [ping, roll],
  buttons: {
    again: (c) => {
      const sides = Number(c.value);
      const rolled = 1 + Math.floor(Math.random() * sides);

      return c.update(`You rolled ${rolled} on a d${sides}.`);
    },
  },
  gateway: 'GATEWAY',
});

export const Gateway = gateway({ intents: ['Guilds'], bot: app, events: {} });

export default app;
