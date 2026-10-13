import { current, unsafe } from 'mutative';
import { createMachine, createActor, type ProvidedActor } from 'xstate';
import { assign, createUpdater, MutativeUpdateEvent } from '../src';

it('should update the context without modifying previous contexts', () => {
  const context = {
    count: 0,
  };
  const countMachine = createMachine({
    types: {} as { context: typeof context },
    id: 'count',
    context,
    initial: 'active',
    states: {
      active: {
        on: {
          INC: {
            actions: assign(({ context }) => context.count++),
          },
        },
      },
    },
  });

  const actorRef = createActor(countMachine).start();
  expect(actorRef.getSnapshot().context).toEqual({ count: 0 });

  actorRef.send({ type: 'INC' });
  expect(actorRef.getSnapshot().context).toEqual({ count: 1 });

  actorRef.send({ type: 'INC' });
  expect(actorRef.getSnapshot().context).toEqual({ count: 2 });
});

it('should perform multiple updates correctly', () => {
  const context = {
    count: 0,
  };
  const countMachine = createMachine(
    {
      types: {} as { context: typeof context },
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            INC_TWICE: {
              actions: ['increment', 'increment'],
            },
          },
        },
      },
    },
    {
      actions: {
        increment: assign(({ context }) => context.count++),
      },
    }
  );

  const actorRef = createActor(countMachine).start();
  expect(actorRef.getSnapshot().context).toEqual({ count: 0 });

  actorRef.send({ type: 'INC_TWICE' });
  expect(actorRef.getSnapshot().context).toEqual({ count: 2 });
});

it('should perform deep updates correctly', () => {
  const context = {
    foo: {
      bar: {
        baz: [1, 2, 3],
      },
    },
  };
  const countMachine = createMachine(
    {
      types: {} as { context: typeof context },
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            INC_TWICE: {
              actions: ['pushBaz', 'pushBaz'],
            },
          },
        },
      },
    },
    {
      actions: {
        pushBaz: assign(({ context }) => context.foo.bar.baz.push(0)),
      },
    }
  );

  const actorRef = createActor(countMachine).start();
  expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3]);

  actorRef.send({ type: 'INC_TWICE' });
  expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3, 0, 0]);
});

it('should create updates', () => {
  interface MyContext {
    foo: {
      bar: {
        baz: number[];
      };
    };
  }
  const context: MyContext = {
    foo: {
      bar: {
        baz: [1, 2, 3],
      },
    },
  };

  type MyEvents =
    | MutativeUpdateEvent<'UPDATE_BAZ', number>
    | MutativeUpdateEvent<'OTHER', string>;

  const bazUpdater = createUpdater<
    typeof context,
    MutativeUpdateEvent<'UPDATE_BAZ', number>,
    MyEvents
  >('UPDATE_BAZ', ({ context, event }) => {
    context.foo.bar.baz.push(event.input);
  });

  const countMachine = createMachine({
    types: {
      context: {} as MyContext,
      events: {} as MyEvents,
    },
    id: 'count',
    context,
    initial: 'active',
    states: {
      active: {
        on: {
          [bazUpdater.type]: {
            actions: bazUpdater.action,
          },
        },
      },
    },
  });

  const actorRef = createActor(countMachine).start();
  expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3]);

  actorRef.send(bazUpdater.update(4));
  expect(actorRef.getSnapshot().context.foo.bar.baz).toEqual([1, 2, 3, 4]);
});

it('should create updates (form example)', (done) => {
  interface FormContext {
    name: string;
    age: number | undefined;
  }

  type NameUpdateEvent = MutativeUpdateEvent<'UPDATE_NAME', string>;
  type AgeUpdateEvent = MutativeUpdateEvent<'UPDATE_AGE', number>;

  type FormEvent =
    | NameUpdateEvent
    | AgeUpdateEvent
    | {
        type: 'SUBMIT';
      };

  const nameUpdater = createUpdater<FormContext, NameUpdateEvent, FormEvent>(
    'UPDATE_NAME',
    ({ context, event }) => {
      context.name = event.input;
    }
  );

  const ageUpdater = createUpdater<FormContext, AgeUpdateEvent, FormEvent>(
    'UPDATE_AGE',
    ({ context, event }) => {
      context.age = event.input;
    }
  );

  const formMachine = createMachine({
    types: {} as { context: FormContext; events: FormEvent },
    initial: 'editing',
    context: {
      name: '',
      age: undefined,
    },
    states: {
      editing: {
        on: {
          [nameUpdater.type]: { actions: nameUpdater.action },
          [ageUpdater.type]: { actions: ageUpdater.action },
          SUBMIT: 'submitting',
        },
      },
      submitting: {
        always: {
          target: 'success',
          guard: ({ context }) => {
            return context.name === 'David' && context.age === 0;
          },
        },
      },
      success: {
        type: 'final',
      },
    },
  });

  const service = createActor(formMachine);
  service.subscribe({
    complete: () => {
      done();
    },
  });
  service.start();

  service.send(nameUpdater.update('David'));
  service.send(ageUpdater.update(0));

  service.send({ type: 'SUBMIT' });
});

it('should freeze the next context deeply with enableAutoFreeze', () => {
  interface Context {
    todos: { text: string; done: boolean }[];
    tags: Set<string>;
    owners: Map<string, { name: string }>;
  }
  const machine = createMachine({
    types: {} as { context: Context },
    context: {
      todos: [{ text: 'learn', done: false }],
      tags: new Set(['a']),
      owners: new Map([['1', { name: 'Ada' }]]),
    },
    on: {
      DONE: {
        actions: assign(
          ({ context }) => {
            context.todos[0].done = true;
            context.tags.add('b');
          },
          { enableAutoFreeze: true }
        ),
      },
      RENAME: {
        actions: assign(
          ({ context }) => {
            context.owners.get('1')!.name = 'Grace';
          },
          { enableAutoFreeze: true }
        ),
      },
    },
  });

  const actorRef = createActor(machine).start();
  const previous = actorRef.getSnapshot().context;
  actorRef.send({ type: 'DONE' });
  const next = actorRef.getSnapshot().context;

  expect(next.todos[0].done).toBe(true);
  expect([...next.tags]).toEqual(['a', 'b']);
  expect(previous.todos[0].done).toBe(false);
  expect([...previous.tags]).toEqual(['a']);
  expect(Object.isFrozen(next.todos)).toBe(true);
  expect(Object.isFrozen(next.todos[0])).toBe(true);
  // Mutative 2 freezes Map and Set instances, also the ones that the next
  // context shares with the previous one.
  expect(Object.isFrozen(next.tags)).toBe(true);
  expect(next.owners).toBe(previous.owners);
  expect(Object.isFrozen(next.owners)).toBe(true);
  expect(Object.isFrozen(next.owners.get('1'))).toBe(true);
  expect(() => next.tags.add('c')).toThrow();
  expect(() => next.owners.set('2', { name: 'Linus' })).toThrow();

  // Later updates copy the frozen parts that they change.
  actorRef.send({ type: 'RENAME' });
  expect(actorRef.getSnapshot().context.owners.get('1')).toEqual({
    name: 'Grace',
  });
  expect(next.owners.get('1')).toEqual({ name: 'Ada' });
});

it('should pass the mutative options of createUpdater', () => {
  interface Context {
    tags: string[];
  }
  type TagEvent = MutativeUpdateEvent<'ADD_TAG', string>;

  const tagUpdater = createUpdater<
    Context,
    TagEvent,
    TagEvent,
    ProvidedActor,
    true
  >(
    'ADD_TAG',
    ({ context, event }) => {
      context.tags.push(event.input);
    },
    { enableAutoFreeze: true }
  );

  const machine = createMachine({
    types: {} as { context: Context; events: TagEvent },
    context: { tags: [] },
    on: {
      [tagUpdater.type]: { actions: tagUpdater.action },
    },
  });

  const actorRef = createActor(machine).start();
  actorRef.send(tagUpdater.update('a'));
  const { tags } = actorRef.getSnapshot().context;
  expect(tags).toEqual(['a']);
  expect(Object.isFrozen(tags)).toBe(true);
});

it('should draft class instances that a mark makes immutable', () => {
  class Todo {
    constructor(public text: string, public done = false) {}
  }
  const machine = createMachine({
    types: {} as { context: { todo: Todo } },
    context: { todo: new Todo('learn') },
    on: {
      DONE: {
        actions: assign(
          ({ context }) => {
            context.todo.done = true;
          },
          {
            mark: (target, { immutable }) =>
              target instanceof Todo ? immutable : undefined,
          }
        ),
      },
    },
  });

  const actorRef = createActor(machine).start();
  const previous = actorRef.getSnapshot().context;
  actorRef.send({ type: 'DONE' });
  const next = actorRef.getSnapshot().context;

  expect(next.todo).toBeInstanceOf(Todo);
  expect(next.todo).not.toBe(previous.todo);
  expect(next.todo.done).toBe(true);
  expect(previous.todo.done).toBe(false);
});

it('should forbid reading values that cannot be drafted in strict mode', () => {
  class Clock {
    now = 1;
  }
  const machine = createMachine({
    types: {} as {
      context: { clock: Clock; now: number };
      events: { type: 'READ' } | { type: 'READ_UNSAFE' };
    },
    context: { clock: new Clock(), now: 0 },
    on: {
      READ_UNSAFE: {
        actions: assign(
          ({ context }) => {
            context.now = unsafe(() => context.clock.now);
          },
          { strict: true }
        ),
      },
      READ: {
        actions: assign(
          ({ context }) => {
            context.now = context.clock.now;
          },
          { strict: true }
        ),
      },
    },
  });

  const errors: unknown[] = [];
  const actorRef = createActor(machine);
  actorRef.subscribe({ error: (error) => errors.push(error) });
  actorRef.start();

  actorRef.send({ type: 'READ_UNSAFE' });
  expect(actorRef.getSnapshot().context.now).toBe(1);
  expect(errors).toEqual([]);

  actorRef.send({ type: 'READ' });
  expect(errors).toHaveLength(1);
  expect(errors[0]).toBeInstanceOf(Error);
  expect(actorRef.getSnapshot().status).toBe('error');
});

it('should move array elements without modifying previous contexts', () => {
  interface Job {
    id: number;
    attempts: number;
  }
  const machine = createMachine({
    types: {} as {
      context: { queue: Job[] };
      events: { type: 'RETRY' } | { type: 'REORDER' };
    },
    context: { queue: [0, 1, 2, 3].map((id) => ({ id, attempts: 0 })) },
    on: {
      RETRY: {
        actions: assign(({ context }) => {
          // shift() returns the removed job as a draft, so changing it leaves
          // the previous context alone.
          const job = context.queue.shift()!;
          job.attempts += 1;
          context.queue.push(job);
        }),
      },
      REORDER: {
        actions: assign(({ context }) => {
          const [job] = context.queue.splice(1, 1);
          context.queue.unshift(job);
          context.queue.reverse();
        }),
      },
    },
  });

  const actorRef = createActor(machine).start();
  const initial = actorRef.getSnapshot().context;
  actorRef.send({ type: 'RETRY' });
  const retried = actorRef.getSnapshot().context;

  expect(retried.queue).toEqual([
    { id: 1, attempts: 0 },
    { id: 2, attempts: 0 },
    { id: 3, attempts: 0 },
    { id: 0, attempts: 1 },
  ]);
  expect(initial.queue).toEqual([
    { id: 0, attempts: 0 },
    { id: 1, attempts: 0 },
    { id: 2, attempts: 0 },
    { id: 3, attempts: 0 },
  ]);
  // The jobs that only moved keep their identity.
  expect(retried.queue[0]).toBe(initial.queue[1]);
  expect(retried.queue[2]).toBe(initial.queue[3]);

  actorRef.send({ type: 'REORDER' });
  const reordered = actorRef.getSnapshot().context;
  expect(reordered.queue.map((job) => job.id)).toEqual([0, 3, 1, 2]);
  expect(retried.queue.map((job) => job.id)).toEqual([1, 2, 3, 0]);
  expect(reordered.queue[0]).toBe(retried.queue[3]);
});

it('should search a current() snapshot and change the match through the draft', () => {
  interface Row {
    id: number;
    paused: boolean;
  }
  const machine = createMachine({
    types: {} as {
      context: { rows: Row[] };
      events: { type: 'PAUSE'; id: number };
    },
    context: {
      rows: Array.from({ length: 2000 }, (_, id) => ({ id, paused: false })),
    },
    on: {
      PAUSE: {
        actions: assign(
          ({ context, event }) => {
            const index = current(context.rows).findIndex(
              (row) => row.id === event.id
            );
            context.rows[index].paused = true;
          },
          { strict: true }
        ),
      },
    },
  });

  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const actorRef = createActor(machine).start();
    const previous = actorRef.getSnapshot().context;
    actorRef.send({ type: 'PAUSE', id: 1500 });
    const next = actorRef.getSnapshot().context;

    expect(next.rows[1500]).toEqual({ id: 1500, paused: true });
    expect(previous.rows[1500]).toEqual({ id: 1500, paused: false });
    expect(next.rows[0]).toBe(previous.rows[0]);
    // A search through the draft would leave a draft for each row that it
    // visits, which strict mode reports in development builds.
    expect(warn).not.toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
