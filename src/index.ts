import {
  create,
  type Draft,
  type Options,
  type PatchesOptions,
} from 'mutative';
import {
  type AssignArgs,
  type EventObject,
  type LowInfer,
  type MachineContext,
  type ParameterizedObject,
  type ProvidedActor,
  assign as xstateAssign,
} from 'xstate';

export type MutativeOptions<O extends PatchesOptions, F extends boolean> = Pick<
  Options<O, F>,
  Exclude<keyof Options<O, F>, 'enablePatches'>
>;

export type MutativeAssigner<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject,
  TParams extends ParameterizedObject['params'] | undefined,
  TEvent extends EventObject,
  TActor extends ProvidedActor
> = (
  args: AssignArgs<Draft<TContext>, TExpressionEvent, TEvent, TActor>,
  params: TParams
) => void;

// With patches, create() returns a tuple instead of the next context, so turn
// them off also for JavaScript callers, which the types do not stop. Other
// options go to create() as they are: it reads them on each call and rejects
// options that are not an object.
function withoutPatches<T>(options: T): T {
  return options && (options as { enablePatches?: unknown }).enablePatches
    ? { ...options, enablePatches: false }
    : options;
}

function mutativeAssign<
  TContext extends MachineContext,
  TExpressionEvent extends EventObject = EventObject,
  TParams extends ParameterizedObject['params'] | undefined =
    | ParameterizedObject['params']
    | undefined,
  TEvent extends EventObject = EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TAutoFreeze extends boolean = boolean
>(
  recipe: MutativeAssigner<TContext, TExpressionEvent, TParams, TEvent, TActor>,
  mutativeOptions?: MutativeOptions<false, TAutoFreeze>
) {
  return xstateAssign<TContext, TExpressionEvent, TParams, TEvent, TActor>(
    (args, params) =>
      create(
        args.context,
        (draft) => {
          recipe(
            { ...args, context: draft } as unknown as AssignArgs<
              Draft<TContext>,
              TExpressionEvent,
              TEvent,
              TActor
            >,
            params
          );
        },
        withoutPatches(mutativeOptions)
      ) as LowInfer<TContext>
  );
}

export { mutativeAssign as assign };

export interface MutativeUpdateEvent<
  TType extends string = string,
  TInput = unknown
> {
  type: TType;
  input: TInput;
}

export function createUpdater<
  TContext extends MachineContext,
  TExpressionEvent extends MutativeUpdateEvent,
  TEvent extends EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TAutoFreeze extends boolean = boolean
>(
  type: TExpressionEvent['type'],
  recipe: MutativeAssigner<
    TContext,
    TExpressionEvent,
    ParameterizedObject['params'] | undefined,
    TEvent,
    TActor
  >,
  mutativeOptions?: MutativeOptions<false, TAutoFreeze>
) {
  const update = (input: TExpressionEvent['input']): TExpressionEvent =>
    ({
      type,
      input,
    } as TExpressionEvent);

  return {
    update,
    action: mutativeAssign<
      TContext,
      TExpressionEvent,
      ParameterizedObject['params'] | undefined, // TODO: not sure if this is correct
      TEvent,
      TActor,
      TAutoFreeze
    >(recipe, mutativeOptions),
    type,
  };
}
