import {screen} from '@testing-library/dom';
import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {act, useState} from 'react';
import {expect, test, vi} from 'vitest';

import {useFormSlice} from './index';
import {createTestHook, initialState} from './test-fixture';

import type {Controller} from './index';
import type {FormStateBeforeValidation} from './test-fixture';

const AgeInputComponent = (props: {controller: Controller<FormStateBeforeValidation>}) => {
  const {controller} = props;
  const [[age, errorMessage], {handleChange}] = useFormSlice(controller, (s) => [s.value.age, s.errors.age] as const);
  return (
    <div>
      <input
        data-testid="age-input"
        value={age}
        name="age"
        onChange={(e) => {
          handleChange('age' as const, e.currentTarget.value);
        }}
      />
      <span data-testid="age-error">{errorMessage}</span>
    </div>
  );
};

type SubmitResult = {success: boolean; data?: unknown; error?: unknown};

/**
 * Wire `handleSubmit` to a DOM button so the submit flow is exercised through
 * a real click. Both callback layers are spies, so the test body can assert
 * on what they received instead of asserting inside the callbacks (which
 * would pass silently if the callbacks were never invoked).
 */
function renderSubmitForm<R>(hook: ReturnType<typeof createTestHook>, inner: (result: SubmitResult) => R) {
  const innerSpy = vi.fn(inner);
  const outerSpy = vi.fn((_e: unknown) => innerSpy);
  const returnedValues: unknown[] = [];
  const submit = hook.handleSubmit(outerSpy);

  render(
    <div>
      <AgeInputComponent controller={hook.controller} />
      <button
        type="button"
        data-testid="submit-button"
        onClick={(e) => {
          void submit(e).then((v) => {
            returnedValues.push(v);
          });
        }}
      />
    </div>,
  );

  return {innerSpy, outerSpy, returnedValues};
}

test('useSelector can select the fields', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  const INPUT_AGE = '4';
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  expect(ageInput.value).toBe(INPUT_AGE);
  expect(TestFormHook.api.getState().value.age).toBe(INPUT_AGE);
  expect(screen.getByTestId('age-error').textContent).toBe('');
});

test('zod parse value before submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = '9';
  const PARSED_RESULT = Number(INPUT_AGE);

  const {innerSpy, outerSpy, returnedValues} = renderSubmitForm(TestFormHook, () => Promise.resolve('returns value'));

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, INPUT_AGE);
  expect(ageInput.value).toBe(INPUT_AGE);

  await userEvent.click(screen.getByTestId('submit-button'));
  await vi.waitFor(() => expect(returnedValues).toEqual(['returns value']));

  expect(outerSpy).toHaveBeenCalledTimes(1);
  expect(innerSpy).toHaveBeenCalledTimes(1);
  expect(innerSpy.mock.calls[0]?.[0]).toMatchObject({
    success: true,
    error: undefined,
    data: {age: PARSED_RESULT},
  });

  const state = TestFormHook.api.getState();
  expect(state.value.age).toBe(INPUT_AGE);
  expect(state.errors.age).toBeNull();
});

test('able to handle parse error on submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = 'aaaa';
  const EXPECTED_ISSUE = {
    code: 'custom',
    message: 'Invalid input',
    path: ['age'],
  };

  const {innerSpy, returnedValues} = renderSubmitForm(TestFormHook, () => Promise.resolve('returns value'));

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, INPUT_AGE);
  expect(ageInput.value).toBe(INPUT_AGE);

  await userEvent.click(screen.getByTestId('submit-button'));
  await vi.waitFor(() => expect(returnedValues).toEqual(['returns value']));

  expect(innerSpy).toHaveBeenCalledTimes(1);
  const received = innerSpy.mock.calls[0]?.[0];
  expect(received?.success).toBe(false);
  expect(received?.error).toStrictEqual([EXPECTED_ISSUE]);

  const state = TestFormHook.api.getState();
  expect(state.value.age).toBe(INPUT_AGE);
  expect(state.errors.age).toBe(EXPECTED_ISSUE.message);
});

test('User is able to re-initialize the form state', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, '9999');

  expect(TestFormHook.api.getState().isDirty).toBeTruthy();
  TestFormHook.actions.initializeForm({}, {cleanup: true});
  expect(TestFormHook.api.getState().isDirty).toBeFalsy();
});

test('User is able to push server side validation', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, '9999');

  TestFormHook.actions.pushFormErrors((_s) => ({
    age: 'server side error',
  }));
  const state1 = TestFormHook.api.getState();
  expect(state1.isDirty).toBeTruthy();
  expect(state1.isValid).toBeFalsy();
  expect(state1.errors.age).toEqual('server side error');

  await userEvent.type(ageInput, 'hgoehoge');

  // confirm empty field won't overwrite any messages
  TestFormHook.actions.pushFormErrors((_s) => ({}));
  const state2 = TestFormHook.api.getState();
  expect(state2.isDirty).toBeTruthy();
  expect(state2.isValid).toBeFalsy();
  expect(state2.errors.age).toEqual('Invalid input');
});

test('pushFormErrors keeps isValid true when the pushed error map is empty', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  // Set valid values for all fields
  TestFormHook.actions.handleBulkChange(() => ({
    name: 'test',
    description: 'desc',
    age: '25',
    marked: true,
  }));

  // Confirm form is valid before pushFormErrors
  const stateBefore = TestFormHook.api.getState();
  expect(stateBefore.isValid).toBe(true);

  // Push empty errors (no actual errors)
  TestFormHook.actions.pushFormErrors(() => ({}));

  // isValid should still be true since there are no real errors
  const stateAfter = TestFormHook.api.getState();
  expect(stateAfter.isValid).toBe(true);
});

test('validation keeps every field key in errors, with null for fields that passed', async () => {
  const TestFormHook = createTestHook();

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
      </div>
    );
  };

  render(<Top />);

  // Type invalid age to trigger a validation error on age only
  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, 'invalid');

  const state = TestFormHook.api.getState();

  // age should have an error
  expect(state.errors.age).toBeTruthy();

  // Other fields should have null (not undefined) — they must still exist as keys
  expect(state.errors.name).toBeNull();
  expect(state.errors.description).toBeNull();
  expect(state.errors.marked).toBeNull();

  // All original keys should be present
  const errorKeys = Object.keys(state.errors).sort();
  const expectedKeys = ['age', 'description', 'marked', 'name'].sort();
  expect(errorKeys).toEqual(expectedKeys);
});

test('reset() restores initial values, clears errors, and resets isDirty', () => {
  const TestFormHook = createTestHook();

  TestFormHook.actions.handleBulkChange(() => ({
    name: 'changed',
    description: 'also changed',
    age: '42',
    marked: true,
  }));
  expect(TestFormHook.api.getState().isDirty).toBe(true);

  TestFormHook.actions.reset();

  const state = TestFormHook.api.getState();
  expect(state.value).toEqual(initialState);
  expect(state.isDirty).toBe(false);
  expect(state.isValid).toBe(false);
  expect(state.errors.name).toBeNull();
  expect(state.errors.age).toBeNull();
});

test('handleBulkChange updates multiple fields and validates once', () => {
  const TestFormHook = createTestHook();

  TestFormHook.actions.handleBulkChange(() => ({
    name: 'test',
    description: 'desc',
    age: '25',
    marked: true,
  }));

  const state = TestFormHook.api.getState();
  expect(state.value.name).toBe('test');
  expect(state.value.description).toBe('desc');
  expect(state.value.age).toBe('25');
  expect(state.value.marked).toBe(true);
  expect(state.isDirty).toBe(true);
  expect(state.isValid).toBe(true);
  // every field entry should be null when the form is fully valid
  expect(Object.values(state.errors).every((v) => v === null)).toBe(true);
});

test('handleChange ignores unknown field names and leaves state unchanged', () => {
  const TestFormHook = createTestHook();
  const before = TestFormHook.api.getState();

  // Cast to bypass the compile-time name constraint — simulating a runtime
  // slip such as a dynamic field name coming from outside the type system.
  (TestFormHook.actions.handleChange as (name: string, value: unknown) => void)('doesNotExist', 'anything');

  const after = TestFormHook.api.getState();
  expect(after).toBe(before);
});

test('useInitialize seeds the form on mount', () => {
  const TestFormHook = createTestHook();

  function App() {
    TestFormHook.useInitialize({name: 'onMount', age: '10'});
    return <div data-testid="mounted" />;
  }

  render(<App />);

  const state = TestFormHook.api.getState();
  expect(state.value.name).toBe('onMount');
  expect(state.value.age).toBe('10');
  // unspecified fields keep their original initial
  expect(state.value.description).toBe('');
  expect(state.value.marked).toBe(false);
});

test('useInitialize does not re-run on subsequent renders', async () => {
  const TestFormHook = createTestHook();

  function App() {
    const [tick, setTick] = useState(0);
    // argument is intentionally a fresh object each render to confirm the
    // effect still does not re-fire (deps are [])
    TestFormHook.useInitialize({name: 'onMount'});
    return (
      <button type="button" data-testid="rerender" onClick={() => setTick(tick + 1)}>
        {tick}
      </button>
    );
  }

  render(<App />);
  expect(TestFormHook.api.getState().value.name).toBe('onMount');

  // mutate state after the initialize effect has already fired
  TestFormHook.actions.handleChange('name', 'changedByUser');
  expect(TestFormHook.api.getState().value.name).toBe('changedByUser');

  // force a re-render; initialize must not clobber the user's input
  await userEvent.click(screen.getByTestId('rerender'));
  expect(TestFormHook.api.getState().value.name).toBe('changedByUser');
});

test('initializeForm merges partial values into the existing state', () => {
  const TestFormHook = createTestHook();

  // Seed one field first so we can verify a later partial call preserves it.
  TestFormHook.actions.initializeForm({description: 'preserved'});
  TestFormHook.actions.initializeForm({name: 'Alice', age: '30'});

  const state = TestFormHook.api.getState();
  expect(state.value.name).toBe('Alice');
  expect(state.value.age).toBe('30');
  expect(state.value.description).toBe('preserved');
  expect(state.value.marked).toBe(false);
});

test('handleSubmit supports a synchronous handler on the success path', async () => {
  const TestFormHook = createTestHook();

  const inner = vi.fn((_result: SubmitResult) => 'sync-success');
  const outer = vi.fn((_e: unknown) => inner);
  const submit = TestFormHook.handleSubmit(outer);

  TestFormHook.actions.handleBulkChange(() => ({
    name: 'a',
    description: 'b',
    age: '5',
    marked: true,
  }));

  const result = await submit({} as never);
  expect(result).toBe('sync-success');
  expect(outer).toHaveBeenCalledTimes(1);
  expect(inner).toHaveBeenCalledTimes(1);
  expect(inner.mock.calls[0]?.[0]).toMatchObject({
    success: true,
    error: undefined,
    data: {name: 'a', description: 'b', age: 5, marked: true},
  });
});

test('handleSubmit supports a synchronous handler on the failure path', async () => {
  const TestFormHook = createTestHook();

  const inner = vi.fn((_result: SubmitResult) => 'sync-failure');
  const outer = vi.fn((_e: unknown) => inner);
  const submit = TestFormHook.handleSubmit(outer);

  // initial state has age='' which fails `min(1)` → schema fails
  const result = await submit({} as never);
  expect(result).toBe('sync-failure');
  expect(outer).toHaveBeenCalledTimes(1);
  expect(inner).toHaveBeenCalledTimes(1);
  expect(inner.mock.calls[0]?.[0]?.success).toBe(false);

  // failure issues should also be pushed into form errors
  const state = TestFormHook.api.getState();
  expect(state.isValid).toBe(false);
  expect(state.errors.age).toBeTruthy();
});

test('validation errors map to their respective fields when multiple fail at once', () => {
  const TestFormHook = createTestHook();

  TestFormHook.actions.handleBulkChange(() => ({
    // `name` and `marked` both violate the schema; `description` stays valid
    name: 123 as unknown as string,
    description: 'ok',
    age: 'notANumber',
    marked: 'notBool' as unknown as boolean,
  }));

  const state = TestFormHook.api.getState();
  expect(state.isValid).toBe(false);
  expect(state.errors.name).toBeTruthy();
  expect(state.errors.marked).toBeTruthy();
  expect(state.errors.age).toBeTruthy();
  expect(state.errors.description).toBeNull();
});

test('handleSubmit resolves when the handler returns undefined on the failure path', async () => {
  const TestFormHook = createTestHook();

  // Handler returns undefined (synchronous, no return value)
  const {innerSpy, returnedValues} = renderSubmitForm(TestFormHook, () => undefined);

  // Type invalid value to trigger the error path where isThennable is called
  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, 'not-a-number');

  // Must resolve (not reject with TypeError: Cannot read properties of undefined (reading 'then'))
  await userEvent.click(screen.getByTestId('submit-button'));
  await vi.waitFor(() => expect(returnedValues).toEqual([undefined]));

  expect(innerSpy).toHaveBeenCalledTimes(1);
  expect(TestFormHook.api.getState().errors.age).toBeTruthy();
});

test('api.actions.reduceFormErrors rewrites the error map through a reducer', () => {
  const TestFormHook = createTestHook();

  TestFormHook.api.actions.reduceFormErrors((prev) => ({...prev, name: 'reduced'}));

  const state = TestFormHook.api.getState();
  expect(state.errors.name).toBe('reduced');
  expect(state.errors.age).toBeNull();
});

test('api.actions.reduceFormState derives the next value from the previous one and validates it', () => {
  const TestFormHook = createTestHook();
  TestFormHook.actions.handleBulkChange(() => ({name: 'n', description: 'd', age: '1', marked: true}));

  TestFormHook.api.actions.reduceFormState((prev) => ({...prev, age: `${prev.age}0`}));
  const valid = TestFormHook.api.getState();
  expect(valid.value.age).toBe('10');
  expect(valid.isValid).toBe(true);

  TestFormHook.api.actions.reduceFormState((prev) => ({...prev, age: 'x'}));
  const invalid = TestFormHook.api.getState();
  expect(invalid.isValid).toBe(false);
  expect(invalid.errors.age).toBe('Invalid input');
});

test('useSelector honours a custom isEqual and skips the re-render when it reports equality', () => {
  const TestFormHook = createTestHook();
  const renders = vi.fn();

  function Age() {
    const age = TestFormHook.useSelector(
      (s) => s.value.age,
      () => true,
    );
    renders();
    return <span data-testid="age">{age}</span>;
  }

  render(<Age />);
  expect(renders).toHaveBeenCalledTimes(1);

  act(() => {
    TestFormHook.actions.handleChange('age', '7');
  });

  expect(TestFormHook.api.getState().value.age).toBe('7');
  expect(renders).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('age').textContent).toBe('');
});

test('api.subscribe is notified with the new state on every change', () => {
  const TestFormHook = createTestHook();
  const listener = vi.fn();
  TestFormHook.api.subscribe(listener);

  TestFormHook.actions.handleChange('name', 'x');
  TestFormHook.actions.pushFormErrors(() => ({name: 'err'}));

  expect(listener).toHaveBeenCalledTimes(2);
  expect(listener.mock.calls[0]?.[0]?.value.name).toBe('x');
  expect(listener.mock.calls[1]?.[0]?.errors.name).toBe('err');
});
