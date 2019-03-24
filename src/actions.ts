export type FormReducerActionTypes = 'CHANGE' | 'SUBMIT' | 'ERROR';
export type FSA<S> = {
  type: FormReducerActionTypes;
  payload: {
    name: keyof S;
    value: S[keyof S];
  };
};

export function changeField<S>(name: keyof S, value: S[keyof S]): FSA<S> {
  return {
    type: 'CHANGE',
    payload: {
      name,
      value,
    },
  };
}

export function submitValue<S>(state: S): FSA<S> {
  return {
    type: 'SUBMIT',
    payload: {} as any, // FIXME: I know this is wrong but it's mendokusai. Fix FSA later.
  };
}
