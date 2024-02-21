import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import React from 'react';

import {test, expect} from 'vitest';

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

const initialState = {name: '', description: '', age: '', marked: false};
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

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });
});

test('zod parse value before submit', async () => {
  const TestFormHook = createTestHook();

  const INPUT_AGE = '9';
  const PARSED_RESULT = Number(INPUT_AGE);

  const handleSubmitTester = TestFormHook.handleSubmit((e) => (result) => {
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

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  const submitButton = screen.getByTestId('submit-button');
  await userEvent.click(submitButton);

  await waitFor(() => {
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

  const handleSubmitTester = TestFormHook.handleSubmit((e) => (result) => {
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

  await waitFor(() => {
    const ageInput: HTMLInputElement = screen.getByTestId('age-input');
    expect(ageInput.value).toBe(INPUT_AGE);
  });

  const submitButton = screen.getByTestId('submit-button');
  await userEvent.click(submitButton);

  await waitFor(() => {
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

  TestFormHook.actions.pushFormErrors((_s) => ({age: 'server side error'}));
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
