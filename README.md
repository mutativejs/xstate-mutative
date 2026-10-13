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

`xstate-mutative` requires Mutative 2 and XState 5. Like Mutative 2, it is built for ES2018. Upgrading from Mutative 1.x? Read the [migration guide](https://mutative.js.org/docs/advanced-guides/migration-v2).

## Usage

Import the Mutative utilities:

```js
import { createMachine, createActor } from 'xstate';
import { assign, createUpdater } from 'xstate-mutative';

const levelUpdater = createUpdater('UPDATE_LEVEL', ({ context, event }) => {
  context.level = event.input;
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
          actions: assign(({ context }) => {
            context.count++;
          }),
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

const toggleActor = createActor(toggleMachine);
toggleActor.subscribe((snapshot) => {
  console.log(snapshot.context);
});
toggleActor.start();
// { count: 0, level: 0 }

toggleActor.send({ type: 'TOGGLE' });
// { count: 1, level: 0 }

toggleActor.send(levelUpdater.update(9));
// { count: 1, level: 9 }

toggleActor.send({ type: 'TOGGLE' });
// { count: 1, level: 9 }

toggleActor.send(levelUpdater.update(-100));
// Notice how the level is not updated in 'inactive' state:
// { count: 1, level: 9 }
```

### TypeScript

`assign()` infers the context and the event from the machine. An updater is created outside the machine, so pass `createUpdater()` the context type, the updater's event type and the machine's event types:

```ts
import { createActor, createMachine } from 'xstate';
import {
  assign,
  createUpdater,
  type MutativeUpdateEvent,
} from 'xstate-mutative';

interface FormContext {
  name: string;
  tags: string[];
}

type NameUpdateEvent = MutativeUpdateEvent<'UPDATE_NAME', string>;
type FormEvent = NameUpdateEvent | { type: 'ADD_TAG'; tag: string };

const nameUpdater = createUpdater<FormContext, NameUpdateEvent, FormEvent>(
  'UPDATE_NAME',
  ({ context, event }) => {
    context.name = event.input;
  }
);

const formMachine = createMachine({
  types: {} as { context: FormContext; events: FormEvent },
  context: { name: '', tags: [] },
  on: {
    [nameUpdater.type]: { actions: nameUpdater.action },
    ADD_TAG: {
      actions: assign(({ context, event }) => {
        context.tags.push(event.tag);
      }),
    },
  },
});

const formActor = createActor(formMachine).start();
formActor.send(nameUpdater.update('David'));
formActor.send({ type: 'ADD_TAG', tag: 'admin' });
// formActor.getSnapshot().context: { name: 'David', tags: ['admin'] }
```

### Mutative Options

`assign()` and `createUpdater()` take Mutative options as their last argument and pass them to Mutative's `create()`:

```js
const addTodo = assign(
  ({ context, event }) => {
    context.todos.push(event.todo);
  },
  { enableAutoFreeze: true }
);
```

- [Strict mode](https://mutative.js.org/docs/advanced-guides/strict-mode): reading a value that cannot be drafted, such as a class instance, throws unless the read happens inside `unsafe()`. Development builds also warn once when a recipe leaves 1,000 or more drafts unchanged, as a search through a large array does; search a `current(context.list)` snapshot instead and change the match through the draft. Import `unsafe()` and `current()` from `mutative`.
- [Auto Freeze](https://mutative.js.org/docs/advanced-guides/auto-freeze): deeply freezes the values that the next context holds, including Map and Set instances since Mutative 2 (XState copies the context object itself, so that object stays unfrozen). It also freezes the class instances that the context holds, so leave it off for a context that holds actor references, such as spawned actors.
- [Marking data structure](https://mutative.js.org/docs/advanced-guides/mark): makes class instances draftable, or keeps values out of drafts.

`enablePatches` is not supported, since an `assign()` action has to return the next context.

### Caveats

- `assign()` ignores what a recipe returns, so a recipe has to change the draft. `assign(() => ({ count: 0 }))`, which works with XState's own `assign()`, leaves the context unchanged here; write `assign(({ context }) => { context.count = 0; })` instead.
- Deleting a key of the context has no effect, as XState merges the next context into a copy of the previous one, which still holds the key. Set the key to `undefined` instead; the context then keeps it with the value `undefined`.
- Recipes have to be synchronous. The draft is revoked when the recipe returns, so changes after an `await` are lost and throw. Do async work in an actor, and assign its result.
- With `enableAutoFreeze`, Mutative also freezes the objects that the next context shares with the previous one. These include the objects of the machine's initial `context`, which every actor of the machine starts with, so don't change them in place elsewhere.

## Credits

`xstate-mutative` is inspired by `@xstate/immer`.

It uses the same API as `@xstate/immer` but uses Mutative under the hood. The repository is based on the `@xstate/immer` repository.

## License

`xstate-mutative` is [MIT licensed](https://github.com/mutativejs/xstate-mutative/blob/main/LICENSE).
