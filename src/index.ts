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

// Distribute over `boolean`, so that a mark that returns a copy function is
// rejected with `enableAutoFreeze: true` also when the freeze flag is not
// inferred, as Mutative throws for that combination.
export type MutativeOptions<
  O extends PatchesOptions,
  F extends boolean
> = F extends boolean
  ? Pick<Options<O, F>, Exclude<keyof Options<O, F>, 'enablePatches'>>
  : never;

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
  // With patches, create() returns a tuple instead of the next context, so
  // turn them off also for JavaScript callers, which the types do not stop.
  const options = { ...mutativeOptions, enablePatches: false as const };
  return xstateAssign<TContext, TExpressionEvent, TParams, TEvent, TActor>(
    ({ context, ...rest }, params) =>
      create(
        context,
        (draft) => {
          recipe(
            {
              context: draft,
              ...rest,
            } as unknown as AssignArgs<
              Draft<TContext>,
              TExpressionEvent,
              TEvent,
              TActor
            >,
            params
          );
        },
        options
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
