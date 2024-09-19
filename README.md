# xstate-mutative

![Node CI](https://github.com/mutativejs/xstate-mutative/workflows/Node%20CI/badge.svg)
[![npm](https://img.shields.io/npm/v/xstate-mutative.svg)](https://www.npmjs.com/package/xstate-mutative)
![license](https://img.shields.io/npm/l/xstate-mutative)

A faster and more flexible utilities for using [Mutative](https://github.com/unadlib/mutative) with XState

`xstate-mutative` is more than 10x faster than `@xstate/immer`. [Read more about the performance comparison in Mutative](https://mutative.js.org/docs/getting-started/performance).

## Installation

In order to use the Mutative utilities in XState, you will need to install Mutative and XState as a direct dependency.

```bash
npm install xstate mutative xstate-mutative
# Or use any package manager of your choice.
```

## Usage

Import the Mutative utilities:

```js
import { createMachine, interpret } from 'xstate';
import { assign, createUpdater } from 'xstate-mutative';

const levelUpdater = createUpdater('UPDATE_LEVEL', (ctx, { input }) => {
  ctx.level = input;
});

const toggleMachine = createMachine({
  id: 'toggle',
  context: {
    count: 0,
    level: 0,
  },
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: {
          target: 'active',
          // Immutably update context the same "mutable"
          // way as you would do with Mutative!
          actions: assign((ctx) => ctx.count++),
        },
      },
    },
    active: {
      on: {
        TOGGLE: {
          target: 'inactive',
        },
        // Use the updater for more convenience:
        [levelUpdater.type]: {
          actions: levelUpdater.action,
        },
      },
    },
  },
});

const toggleService = interpret(toggleMachine)
  .onTransition((state) => {
    console.log(state.context);
  })
  .start();

toggleService.send({ type: 'TOGGLE' });
// { count: 1, level: 0 }

toggleService.send(levelUpdater.update(9));
// { count: 1, level: 9 }

toggleService.send({ type: 'TOGGLE' });
// { count: 2, level: 9 }

toggleService.send(levelUpdater.update(-100));
// Notice how the level is not updated in 'inactive' state:
// { count: 2, level: 9 }
```

### Mutative Options

- [Strict mode](https://mutative.js.org/docs/advanced-guides/strict-mode)
- [Auto Freeze](https://mutative.js.org/docs/advanced-guides/auto-freeze)
- [Marking data structure](https://mutative.js.org/docs/advanced-guides/mark)

## Credits

`xstate-mutative` is inspired by `@xstate/immer`.

It uses the same API as `@xstate/immer` but uses Mutative under the hood. The repository is based on the `@xstate/immer` repository.

## License

`xstate-mutative` is [MIT licensed](https://github.com/mutativejs/xstate-mutative/blob/main/LICENSE).
