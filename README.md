[![Lint Check](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml/badge.svg)](https://github.com/hachibeeDI/mayoiga/actions/workflows/checker.yml)

# Mayoiga

The React Hook based form library. Of course it is TypeScript friendly.


## Supported functionality

- TypeScript oriented
- Form level validation
- Submit level validation
- Less learning cost
- Cooperate with any component library (Bootstarap, MaterialDesign, ant-design or whatever )

With less boilerplate code!!


## How to use

### API you should see

There are only two functions which you should know to use Mayoiga.

- [useForm](https://hachibeedi.github.io/mayoiga/modules/_mayoiga_.html#useform)

- [createFormScope](https://hachibeedi.github.io/mayoiga/modules/_mayoiga_.html#createformscope)


### Minimum example:

```typeScript

const TestFormHook = createFormHook({name:'', description: '', age: ''} as FormStateBeforeValidation, testSchema);

const INPUT_AGE = '9';
const PARSED_RESULT = Number(INPUT_AGE);

const handleSubmitTester = TestFormHook.handleSubmit((e) => (result) => {
  if (result.success) {
    expect(result.data.age).toBe(PARSED_RESULT);
  } else {
    expect('should not called').toBe(result.err);
  }
});

const Top = () => {
  return (
    <div>
      <AgeInputComponent formHook={TestFormHook} />
      <button data-testid="submit-button" onClick={handleSubmitTester} />
    </div>
  )
};

act(() => {
  render(<Top />);
});

```
