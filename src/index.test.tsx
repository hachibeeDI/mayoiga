import {screen} from '@testing-library/dom';
import {render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {act} from 'react';
import {expect, test} from 'vitest';

import * as zod from 'zod';

import {createFormHook, useFormSlice} from './index';

import type {Controller} from './index';

const testSchema = zod.object({
  name: zod.string(),
  description: zod.string(),
  age: zod
    .string()
    .transform((val) => Number(val))
    .refine((val) => (Number.isNaN(val) ? 0 : val)),
  marked: zod.boolean(),
});

// every fields are optional for test
type FormStateBeforeValidation = {
  name: string;
  description: string;
  age: string;
  marked: boolean;
};

const initialState = {
  name: '',
  description: '',
  age: '',
  marked: false,
};
const createTestHook = () => createFormHook(initialState as FormStateBeforeValidation, testSchema);

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

// afterEach(cleanup);

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

  // fireEvent.change(screen.getByTestId('age-input') , {target: {value: INPUT_AGE}})
  // calling `userEvent` in here will cause race condition...
  await userEvent.type(screen.getByTestId('age-input'), INPUT_AGE);
  // TestFormHook.actions.handleBulkChange(prev => ({...prev, name: 'test', description: 'desc'}));

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });
});

test('zod parse value before submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = '9';
  const PARSED_RESULT = Number(INPUT_AGE);

  const handleSubmitTester = TestFormHook.handleSubmit((_e) => (result) => {
    if (result.success) {
      expect(result.data.age).toBe(PARSED_RESULT);
    } else {
      expect('should not called').toBe(result.error);
    }
    return Promise.resolve('returns value');
  });

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook} />
        <button
          type="button"
          data-testid="submit-button"
          onClick={async (e) => {
            const returnedValue = await handleSubmitTester(e);
            expect(returnedValue).toBe('returns value');
          }}
        />
      </div>
    );
  };

  render(<Top />);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, INPUT_AGE);

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  const submitButton = screen.getByTestId('submit-button');
  await userEvent.click(submitButton);

  await act(() => {
    console.log('waiting');
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBeNull();
    });
  });
});

test('able to handle parse error on submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = 'aaaa';
  const EXPECTED_ISSUE = {
    code: 'custom',
    message: 'Invalid input',
    path: ['age'],
  };

  const handleSubmitTester = TestFormHook.handleSubmit((_e) => (result) => {
    if (result.success) {
      expect('should not succeed').toBe(false);
    } else {
      expect(result.success).toBe(false);
      expect(result.error).toStrictEqual([EXPECTED_ISSUE]);
    }
    return Promise.resolve('returns value');
  });

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook} />
        <button
          type="button"
          data-testid="submit-button"
          onClick={async (e) => {
            const returnedValue = await handleSubmitTester(e);
            expect(returnedValue).toBe('returns value');
          }}
        />
      </div>
    );
  };

  render(<Top />);

  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, INPUT_AGE);

  await act(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  const submitButton = screen.getByTestId('submit-button');
  await userEvent.click(submitButton);

  await act(() => {
    console.log('waiting');
    TestFormHook.api.actions.peek((s) => {
      expect(s.value.age).toBe(INPUT_AGE);
      expect(s.errors.age).toBe(EXPECTED_ISSUE.message);
    });
  });
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

// ============================================================
// Bug detection tests
// ============================================================

test('BUG: pushFormErrors should set isValid to true when no actual errors exist', async () => {
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

test('BUG: withValidation should keep all field keys in errors object (not drop missing ones)', async () => {
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

test('BUG: isThennable should not crash when handler returns null or undefined', async () => {
  const TestFormHook = createTestHook();

  // Handler returns undefined (synchronous, no return value)
  const handleSubmitTester = TestFormHook.handleSubmit((_e) => (_result) => {
    // intentionally return undefined
    return undefined;
  });

  const Top = () => {
    return (
      <div>
        <AgeInputComponent controller={TestFormHook.controller} />
        <button
          type="button"
          data-testid="submit-button"
          onClick={async (e) => {
            // This should not throw even when handler returns undefined
            await handleSubmitTester(e);
          }}
        />
      </div>
    );
  };

  render(<Top />);

  // Type invalid value to trigger the error path where isThennable is called
  const ageInput: HTMLInputElement = screen.getByTestId('age-input');
  await userEvent.type(ageInput, 'not-a-number');

  const submitButton = screen.getByTestId('submit-button');
  // This should not throw TypeError: Cannot read properties of undefined (reading 'then')
  await userEvent.click(submitButton);

  // If we reach here, isThennable didn't crash
  const state = TestFormHook.api.getState();
  expect(state.errors.age).toBeTruthy();
});
