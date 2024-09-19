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

export { mutativeAssign as assign };

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
  TAutoFreeze extends boolean = false
>(
  recipe: MutativeAssigner<TContext, TExpressionEvent, TParams, TEvent, TActor>,
  mutativeOptions?: MutativeOptions<false, TAutoFreeze>
) {
  return xstateAssign<TContext, TExpressionEvent, TParams, TEvent, TActor>(
    ({ context, ...rest }, params) => {
      return create(
        context,
        (draft) =>
          void recipe(
            {
              context: draft,
              ...rest,
            } as any,
            params
          ),
        mutativeOptions
      ) as LowInfer<TContext>;
    }
  );
}

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
  TActor extends ProvidedActor = ProvidedActor
>(
  type: TExpressionEvent['type'],
  recipe: MutativeAssigner<
    TContext,
    TExpressionEvent,
    ParameterizedObject['params'] | undefined,
    TEvent,
    TActor
  >
) {
  const update = (input: TExpressionEvent['input']): TExpressionEvent => {
    return {
      type,
      input,
    } as TExpressionEvent;
  };

  return {
    update,
    action: mutativeAssign<
      TContext,
      TExpressionEvent,
      ParameterizedObject['params'] | undefined, // TODO: not sure if this is correct
      TEvent,
      TActor
    >(recipe),
    type,
  };
}
